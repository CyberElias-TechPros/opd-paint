/**
 * OPUDA'S PAINT — enquiry service.
 *
 * A deliberately small Node service with no framework and no database:
 *   • JSON-lines append-only storage, which is easy to audit and easy to export;
 *   • server-side validation of every field (the client validates for UX, the
 *     server validates for truth);
 *   • a honeypot plus per-IP rate limiting;
 *   • a stable reference number returned to the visitor so a phone call can be
 *     matched to a record;
 *   • colour search for the API surface (the SPA also indexes locally, so this
 *     endpoint is not on the critical path).
 *
 * Production note: this writes to disk on a single node. Before launch it must
 * sit behind the CRM integration (roadmap 14.01) with retries and a recovery
 * queue; the JSONL file is then the fallback rather than the destination.
 */
import { createServer } from 'node:http'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const QUOTES_FILE = join(DATA_DIR, 'quotes.jsonl')
const SUBS_FILE = join(DATA_DIR, 'subscriptions.jsonl')
const PORT = Number(process.env.PORT ?? 8787)

const COLOURS_FILE = join(__dirname, '..', 'app', 'src', 'data', 'colors.ts')

/* --------------------------------------------------------------- utilities */
const buckets = new Map()

/** Fixed-window rate limiter: 12 submissions per IP per 10 minutes. */
function rateLimited(ip, limit = 12, windowMs = 10 * 60 * 1000) {
  const now = Date.now()
  const bucket = buckets.get(ip)
  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(ip, { start: now, count: 1 })
    return false
  }
  bucket.count += 1
  return bucket.count > limit
}

function send(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  res.end(payload)
}

async function readJson(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Malformed JSON'))
      }
    })
    req.on('error', reject)
  })
}

const str = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const digits = (value) => String(value ?? '').replace(/[^\d]/g, '')
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

function reference(date = new Date()) {
  const y = String(date.getFullYear()).slice(2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const tail = randomUUID().replace(/[^a-f0-9]/g, '').slice(0, 4).toUpperCase()
  return `OPD-${y}${m}${d}-${tail}`
}

function routeFor(projectType) {
  switch (projectType) {
    case 'trade':
      return 'Trade & contracts desk'
    case 'sample':
      return 'Sample & colour desk'
    case 'dealer':
      return 'Commercial team — dealer enquiries'
    case 'exterior':
      return 'Technical desk — exterior specification'
    default:
      return 'Colour desk — Lagos'
  }
}

async function ensureData() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
}

/* ------------------------------------------------------------------ routes */
const server = createServer(async (req, res) => {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname

  if (req.method === 'GET' && path === '/api/health') {
    send(res, 200, { ok: true, data: { service: 'opd-enquiries', uptime: process.uptime(), time: new Date().toISOString() } })
    return
  }

  if (req.method === 'GET' && path === '/api/search/colours') {
    const q = str(url.searchParams.get('q'), 80).toLowerCase()
    try {
      const source = await readFile(COLOURS_FILE, 'utf8')
      const matches = [...source.matchAll(/id:\s*'([^']+)',\s*code:\s*'([^']+)',\s*name:\s*'([^']+)'/g)]
      const results = matches
        .map(([, id, code, name]) => ({ id, code, name }))
        .filter((colour) => !q || `${colour.name} ${colour.code}`.toLowerCase().includes(q))
        .slice(0, 12)
      send(res, 200, { results })
    } catch {
      send(res, 500, { ok: false, error: 'Colour index unavailable' })
    }
    return
  }

  if (req.method === 'POST' && path === '/api/quotes') {
    if (rateLimited(ip)) {
      send(res, 429, { ok: false, error: 'Too many enquiries from this connection. Please call us instead.' })
      return
    }
    let body
    try {
      body = await readJson(req)
    } catch {
      send(res, 400, { ok: false, error: 'We could not read that submission.' })
      return
    }

    // Honeypot: hidden field must be empty. Look successful to the bot, do nothing.
    if (str(body.company)) {
      send(res, 200, { ok: true, data: { reference: reference(), receivedAt: new Date().toISOString(), routedTo: 'Colour desk', slaHours: 24 } })
      return
    }

    const fields = {}
    const name = str(body.name, 120)
    const phoneRaw = str(body.phone, 40)
    const phoneDigits = digits(phoneRaw)
    const email = str(body.email, 160)
    const city = str(body.city, 120)
    const projectType = str(body.projectType, 40)
    const rooms = str(body.rooms, 200)
    const message = str(body.message, 4000)

    if (name.length < 2) fields.name = 'A name is required.'
    if (phoneDigits.length < 7 || phoneDigits.length > 15) fields.phone = 'A reachable phone number is required.'
    if (email && !EMAIL.test(email)) fields.email = 'That email address is not valid.'
    if (city.length < 2) fields.city = 'The project city or area is required.'
    if (!projectType) fields.projectType = 'Project type is required.'
    if (body.consent !== true) fields.consent = 'Consent is required to store and answer the enquiry.'

    if (Object.keys(fields).length) {
      send(res, 422, { ok: false, error: 'Some details need attention.', fields })
      return
    }

    const record = {
      reference: reference(),
      receivedAt: new Date().toISOString(),
      name,
      phone: phoneRaw,
      email: email || null,
      city,
      projectType,
      rooms: rooms || null,
      message: message || null,
      colors: Array.isArray(body.colors) ? body.colors.slice(0, 12).map((c) => str(c, 20)) : [],
      products: Array.isArray(body.products) ? body.products.slice(0, 12).map((p) => str(p, 20)) : [],
      source: str(body.source, 60) || 'website',
      consent: { granted: true, at: new Date().toISOString(), basis: 'enquiry-reply' },
      meta: { ua: str(req.headers['user-agent'], 200) },
    }

    try {
      await ensureData()
      await appendFile(QUOTES_FILE, JSON.stringify(record) + '\n', 'utf8')
      // eslint-disable-next-line no-console
      console.log(`[quote] ${record.reference} ${record.projectType} ${record.city}`)
      send(res, 201, {
        ok: true,
        data: {
          reference: record.reference,
          receivedAt: record.receivedAt,
          routedTo: routeFor(projectType),
          slaHours: projectType === 'dealer' ? 48 : 24,
        },
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[quote] storage failure', error)
      send(res, 503, { ok: false, error: 'We could not save your enquiry. Please call 0902 642 4350.' })
    }
    return
  }

  if (req.method === 'POST' && path === '/api/subscribe') {
    if (rateLimited(ip, 6)) {
      send(res, 429, { ok: false, error: 'Too many requests. Try again later.' })
      return
    }
    let body
    try {
      body = await readJson(req, 4 * 1024)
    } catch {
      send(res, 400, { ok: false, error: 'Malformed request.' })
      return
    }
    const email = str(body.email, 160)
    if (!EMAIL.test(email)) {
      send(res, 422, { ok: false, error: 'Enter a valid email address.' })
      return
    }
    try {
      await ensureData()
      await appendFile(SUBS_FILE, JSON.stringify({ email, interest: str(body.interest, 40), at: new Date().toISOString() }) + '\n', 'utf8')
      send(res, 201, { ok: true, data: { email } })
    } catch {
      send(res, 503, { ok: false, error: 'Subscription service unavailable.' })
    }
    return
  }

  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  send(res, 404, { ok: false, error: 'Unknown endpoint' })
})

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[api] enquiry service on http://0.0.0.0:${PORT}`)
})
