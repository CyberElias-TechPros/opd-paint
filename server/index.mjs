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
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { log, requestId, describeError } from './logger.mjs'
import { configuredChannels, notifyEnquiry } from './notify.mjs'
import { recordError } from './errors.mjs'
import { handleAdminContentApi, renderContentAdminPage } from './admin-content.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The data directory is configurable so tests (and a staging box) can run
// against a scratch directory instead of the real enquiry log.
const DATA_DIR = process.env.OPD_DATA_DIR ? resolve(process.env.OPD_DATA_DIR) : join(__dirname, 'data')
const QUOTES_FILE = join(DATA_DIR, 'quotes.jsonl')
const SUBS_FILE = join(DATA_DIR, 'subscriptions.jsonl')
const PORT = Number(process.env.PORT ?? 8787)

// The enquiry inbox is only mounted when credentials are configured. An
// unauthenticated admin page is not a feature, it is an incident.
// Optionally serve the built site from this process, so a deployment is one
// container and one port. A reverse proxy in front is still a good idea for TLS
// and compression, but nothing here *requires* one.
const STATIC_DIR = process.env.OPD_STATIC_DIR ? resolve(process.env.OPD_STATIC_DIR) : ''

const ADMIN_USER = process.env.OPD_ADMIN_USER ?? ''
const ADMIN_PASSWORD = process.env.OPD_ADMIN_PASSWORD ?? ''
const ADMIN_ENABLED = Boolean(ADMIN_USER && ADMIN_PASSWORD)

const COLOURS_FILE = join(__dirname, '..', 'app', 'src', 'data', 'colors.ts')

/* --------------------------------------------------------------- utilities */
const buckets = new Map()

/**
 * Fixed-window rate limiter, scoped per endpoint.
 *
 * Scoping matters: enquiries are limited to 12 per 10 minutes and newsletter
 * sign-ups to 6, and sharing one bucket meant a busy quoting session could lock
 * a visitor out of subscribing. The trade-off is memory only — a restart clears
 * it, which is acceptable for a single node and is why the limiter is a second
 * line of defence rather than the first.
 */
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
        // Drain rather than destroy: destroying the socket means the client
        // sees a connection reset and never reads the 413 we are about to send.
        chunks.length = 0
        req.resume()
        reject(new Error('Payload too large'))
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
      return 'Colour desk — Port Harcourt'
  }
}

async function ensureData() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
}

/* ------------------------------------------------------------------ routes */


/* ---------------------------------------------------------------- statics */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
}

// Scripts and styles are content-hashed, so they can be cached forever. The
// HTML shell must not be, or a deploy never reaches a returning visitor.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

/**
 * Serve a file from the built site, or the app shell for client-side routes.
 *
 * Returns false when no static directory is configured, so the API can run on
 * its own during development.
 */
async function serveStatic(req, res, pathname) {
  if (!STATIC_DIR || (req.method !== 'GET' && req.method !== 'HEAD')) return false

  // Resolve inside the root and refuse anything that escapes it.
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '')
  const candidate = resolve(STATIC_DIR, relative)
  if (!candidate.startsWith(STATIC_DIR)) return false

  const looksLikeFile = /\.[a-z0-9]+$/i.test(relative)
  let filePath = candidate
  let info = null
  // 200 for something that exists; 404 for the branded not-found document.
  let status = 200
  try {
    info = await stat(filePath)
    if (info.isDirectory()) {
      // A prerendered route lives at dist/<path>/index.html. Serve that rather
      // than the shell, so the URL keeps its own title and description.
      const index = join(filePath, 'index.html')
      info = await stat(index)
      filePath = index
    }
  } catch {
    if (looksLikeFile) return false
    // An unknown path. Serving the shell with a 200 would tell a crawler that
    // every typo is a page, so serve the prerendered not-found document with
    // the status it deserves. The client router takes over from there.
    filePath = join(STATIC_DIR, '404.html')
    try {
      info = await stat(filePath)
      status = 404
    } catch {
      return false
    }
  }

  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  const immutable = filePath.includes(`${'/assets/'}`) || /\.(woff2|webp|jpg|png|mp4)$/i.test(filePath)
  const headers = {
    'Content-Type': MIME[extension] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Last-Modified': info.mtime.toUTCString(),
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    ...(extension === '.html' ? SECURITY_HEADERS : {}),
  }
  res.writeHead(status, headers)
  if (req.method === 'HEAD') {
    res.end()
    return true
  }
  createReadStream(filePath)
    .on('error', () => res.end())
    .pipe(res)
  return true
}

/* ------------------------------------------------------------------ admin */

/** Constant-time comparison so the inbox cannot be probed by timing. */
function sameSecret(candidate, expected) {
  const a = createHash('sha256').update(String(candidate)).digest()
  const b = createHash('sha256').update(String(expected)).digest()
  return timingSafeEqual(a, b)
}

function isAdmin(req) {
  if (!ADMIN_ENABLED) return false
  const header = req.headers.authorization ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const separator = decoded.indexOf(':')
  if (separator === -1) return false
  const user = decoded.slice(0, separator)
  const pass = decoded.slice(separator + 1)
  // Evaluate both comparisons before returning, so a wrong username and a
  // wrong password take the same time.
  const userOk = sameSecret(user, ADMIN_USER)
  const passOk = sameSecret(pass, ADMIN_PASSWORD)
  return userOk && passOk
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Read a JSONL file, skipping damaged lines.
 *
 * Skipping is right — one truncated line (a disk that filled mid-append, a
 * `kill -9`) must not hide every enquiry before it — but skipping *silently*
 * is how data loss goes unnoticed for a year. Every skip is logged, and health
 * reports the count so a monitor can alert on it.
 */
async function readRecords(file) {
  try {
    const raw = await readFile(file, 'utf8')
    let damaged = 0
    const records = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        records.push(JSON.parse(line))
      } catch {
        damaged += 1
      }
    }
    if (damaged) {
      log.warn('storage.damaged_lines', { file: file.split('/').pop(), damaged })
    }
    return records
  } catch {
    return []
  }
}

// Health is polled by a monitor, so the damage count is memoised rather than
// re-reading the whole log on every probe. The key is the file's own mtime and
// size, not a clock: a count that goes stale for a minute after a new damaged
// line appears is exactly the minute somebody is looking at the dashboard.
let damageCache = { key: '', count: 0 }

async function damagedRecordCount() {
  try {
    const info = await stat(QUOTES_FILE)
    const key = `${info.mtimeMs}:${info.size}`
    if (key === damageCache.key) return damageCache.count

    const raw = await readFile(QUOTES_FILE, 'utf8')
    let count = 0
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        JSON.parse(line)
      } catch {
        count += 1
      }
    }
    damageCache = { key, count }
    return count
  } catch {
    // No file yet is not damage.
    return 0
  }
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function demandAuth(res) {
  const body = 'Authentication required.'
  res.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'WWW-Authenticate': 'Basic realm="OPUDA\'S PAINT enquiries", charset="UTF-8"',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  })
  res.end(body)
}

async function handle(req, res) {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname

  // A request id ties the log lines for one request together, and appears in
  // the response so a visitor quoting it to support can be traced to a record.
  const id = requestId()
  res.setHeader('X-Request-Id', id)
  const startedAt = performance.now()
  res.on('finish', () => {
    // Static assets are noise; everything else is worth a line.
    if (path.startsWith('/assets/') || path.startsWith('/media/') || path.startsWith('/documents/')) return
    log.info('http.request', {
      id,
      method: req.method,
      path,
      status: res.statusCode,
      ms: Math.round(performance.now() - startedAt),
    })
  })

  // Anything that is not an API or admin path can be served from the build.
  if (!path.startsWith('/api/') && !path.startsWith('/admin') && (await serveStatic(req, res, path))) {
    return
  }

  if (req.method === 'GET' && path === '/api/health') {
    // Health is public, so it reports capability, never configuration detail:
    // which notification channels exist, not their URLs or credentials.
    let dataDir = 'absent'
    try {
      await stat(DATA_DIR)
      dataDir = 'ready'
    } catch {
      dataDir = 'not-created-yet'
    }
    send(res, 200, {
      ok: true,
      data: {
        service: 'opd-enquiries',
        version: process.env.OPD_RELEASE ?? 'dev',
        uptime: Math.round(process.uptime()),
        time: new Date().toISOString(),
        storage: dataDir,
        damagedRecords: await damagedRecordCount(),
        notifications: configuredChannels(),
        inbox: ADMIN_ENABLED,
        errorForwarding: Boolean(process.env.OPD_SENTRY_DSN),
      },
    })
    return
  }

  if (req.method === 'POST' && path === '/api/errors') {
    // Diagnostics, not analytics: no consent gate, but also no identifiers, and
    // a rate limit so a loop in one broken browser cannot fill the disk.
    if (rateLimited(`${ip}:errors`, 20)) {
      send(res, 429, { ok: false, error: 'Too many error reports.' })
      return
    }
    let body
    try {
      body = await readJson(req, 12 * 1024)
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'Payload too large'
      // Never echo the payload back — it may contain a stack with a token in it.
      send(res, tooLarge ? 413 : 400, { ok: false, error: 'Report rejected.' })
      return
    }
    try {
      await ensureData()
      const { eventId } = await recordError(body, { dataDir: DATA_DIR, ip })
      send(res, 202, { ok: true, data: { eventId } })
    } catch (error) {
      log.error('errors.intake_failed', { id, ...describeError(error) })
      send(res, 202, { ok: true, data: { eventId: null } })
    }
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
    if (rateLimited(`${ip}:quotes`)) {
      send(res, 429, { ok: false, error: 'Too many enquiries from this connection. Please call us instead.' })
      return
    }
    let body
    try {
      body = await readJson(req)
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'Payload too large'
      send(res, tooLarge ? 413 : 400, {
        ok: false,
        error: tooLarge ? 'That submission is too large. Please shorten it or call us.' : 'We could not read that submission.',
      })
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

      const routing = { routedTo: routeFor(projectType), slaHours: projectType === 'dealer' ? 48 : 24 }
      log.info('enquiry.received', {
        id,
        reference: record.reference,
        projectType: record.projectType,
        routedTo: routing.routedTo,
      })

      // Answer the visitor first. Delivery to a human happens afterwards, so a
      // slow webhook can never make a submitted enquiry feel broken.
      send(res, 201, { ok: true, data: { reference: record.reference, receivedAt: record.receivedAt, ...routing } })
      void notifyEnquiry(record, routing, { dataDir: DATA_DIR })
    } catch (error) {
      log.error('enquiry.storage_failed', { id, ...describeError(error) })
      send(res, 503, { ok: false, error: 'We could not save your enquiry. Please call 0902 642 4350.' })
    }
    return
  }

  if (req.method === 'POST' && path === '/api/subscribe') {
    if (rateLimited(`${ip}:subscribe`, 6)) {
      send(res, 429, { ok: false, error: 'Too many requests. Try again later.' })
      return
    }
    let body
    try {
      body = await readJson(req, 4 * 1024)
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'Payload too large'
      send(res, tooLarge ? 413 : 400, { ok: false, error: tooLarge ? 'That request is too large.' : 'Malformed request.' })
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


  /* ------------------------------------------------------------- inbox */

  if (req.method === 'GET' && (path === '/admin' || path === '/admin/enquiries.csv')) {
    // 404 rather than 401 when the inbox is not configured: an endpoint that
    // does not exist cannot be attacked, and this one is optional by design.
    if (!ADMIN_ENABLED) {
      send(res, 404, { ok: false, error: 'Unknown endpoint' })
      return
    }
    if (!isAdmin(req)) {
      demandAuth(res)
      return
    }

    const [quotes, subscriptions] = await Promise.all([
      readRecords(QUOTES_FILE),
      readRecords(SUBS_FILE),
    ])
    const newestFirst = [...quotes].reverse()

    if (path === '/admin/enquiries.csv') {
      const columns = [
        'reference', 'receivedAt', 'name', 'phone', 'email', 'city', 'projectType',
        'rooms', 'colors', 'products', 'routedTo', 'message', 'source',
      ]
      const rows = [columns.join(',')]
      for (const record of newestFirst) {
        rows.push(columns.map((key) => csvCell(record[key])).join(','))
      }
      const body = `${rows.join('\n')}\n`
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Content-Disposition': `attachment; filename="opudas-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      })
      res.end(body)
      return
    }

    const desks = newestFirst.reduce((counts, record) => {
      const key = record.routedTo ?? 'Unrouted'
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
    const today = new Date().toISOString().slice(0, 10)
    const todays = newestFirst.filter((record) => String(record.receivedAt ?? '').startsWith(today)).length

    const rows = newestFirst
      .map((record) => {
        const when = new Date(record.receivedAt ?? Date.now())
        return `<tr>
          <th scope="row"><code>${escapeHtml(record.reference)}</code></th>
          <td>${escapeHtml(when.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
          <td>${escapeHtml(record.name)}<br><span class="muted">${escapeHtml(record.city)}</span></td>
          <td><a href="tel:${escapeHtml(record.phone)}">${escapeHtml(record.phone)}</a>
            ${record.email ? `<br><a class="muted" href="mailto:${escapeHtml(record.email)}">${escapeHtml(record.email)}</a>` : ''}</td>
          <td>${escapeHtml(record.projectType)}${record.rooms ? ` · ${escapeHtml(record.rooms)}` : ''}</td>
          <td>${escapeHtml(record.routedTo ?? '—')}</td>
          <td class="wide">${escapeHtml(record.message ?? '')}
            ${(record.colors ?? []).length ? `<div class="muted">Colours: ${escapeHtml((record.colors ?? []).join(', '))}</div>` : ''}
            ${(record.products ?? []).length ? `<div class="muted">Products: ${escapeHtml((record.products ?? []).join(', '))}</div>` : ''}
          </td>
        </tr>`
      })
      .join('\n')

    const html = `<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Enquiries — OPUDA'S PAINT</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2rem clamp(1rem, 4vw, 3rem) 4rem; background: #f7f2e9; color: #0b1a13;
         font: 15px/1.55 "Archivo", ui-sans-serif, system-ui, sans-serif; }
  h1 { font: 400 clamp(1.8rem, 4vw, 2.6rem)/1.05 "Instrument Serif", Georgia, serif; margin: 0 0 .4rem; }
  p.lede { margin: 0 0 1.5rem; color: #4d6157; max-width: 48rem; }
  .stats { display: flex; flex-wrap: wrap; gap: .6rem; margin-bottom: 1.6rem; }
  .stat { border: 1px solid #d8cdbb; border-radius: 3px; padding: .55rem .8rem; background: #fcf9f3; }
  .stat b { display: block; font-size: 1.4rem; line-height: 1.1; }
  .stat span { font-size: .72rem; text-transform: uppercase; letter-spacing: .12em; color: #4d6157; }
  table { border-collapse: collapse; width: 100%; background: #fcf9f3; border: 1px solid #d8cdbb; }
  th, td { text-align: left; padding: .6rem .7rem; border-bottom: 1px solid #e6ddcf; vertical-align: top; font-size: .86rem; }
  thead th { background: #0b1a13; color: #fcf9f3; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; }
  tbody th { font-weight: 600; white-space: nowrap; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; }
  .muted { color: #4d6157; font-size: .78rem; }
  .wide { max-width: 26rem; }
  .actions { margin-bottom: 1.2rem; display: flex; gap: .6rem; flex-wrap: wrap; }
  .actions a { border: 1px solid #0b1a13; border-radius: 3px; padding: .5rem .9rem; text-decoration: none;
               color: #fcf9f3; background: #0c6b45; font-weight: 600; font-size: .8rem; }
  .actions a.ghost { background: transparent; color: #0b1a13; }
  .empty { border: 1px dashed #d8cdbb; padding: 2rem; text-align: center; color: #4d6157; background: #fcf9f3; }
  footer { margin-top: 2rem; color: #4d6157; font-size: .78rem; max-width: 52rem; }
  @media (max-width: 780px) { thead { display: none; } tr { display: block; border-bottom: 2px solid #d8cdbb; }
    td, tbody th { display: block; border: 0; } td::before { content: attr(data-label); display: block;
    font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; color: #4d6157; } }
</style>
</head>
<body>
  <h1>Enquiries</h1>
  <p class="lede">Every enquiry submitted through the site, newest first. This page reads the append-only log on
    this machine; it is deliberately read-only, so nothing here can alter a customer record.</p>
  <div class="stats">
    <div class="stat"><b>${quotes.length}</b><span>Total</span></div>
    <div class="stat"><b>${todays}</b><span>Today</span></div>
    <div class="stat"><b>${subscriptions.length}</b><span>Guide subscribers</span></div>
    ${Object.entries(desks).map(([desk, count]) => `<div class="stat"><b>${count}</b><span>${escapeHtml(desk)}</span></div>`).join('')}
  </div>
  <div class="actions">
    <a href="/admin/enquiries.csv">Download CSV</a>
    <a class="ghost" href="/">Open the site</a>
  </div>
  ${
    newestFirst.length
      ? `<table>
    <caption class="muted" style="text-align:left;padding:.4rem 0">${newestFirst.length} record${newestFirst.length === 1 ? '' : 's'}</caption>
    <thead><tr><th scope="col">Reference</th><th scope="col">Received</th><th scope="col">Contact</th>
      <th scope="col">Phone / email</th><th scope="col">Project</th><th scope="col">Desk</th><th scope="col">Message</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>`
      : '<p class="empty">No enquiries yet. The form on <a href="/quote">/quote</a> writes here.</p>'
  }
  <footer>
    Stored as JSON lines in <code>server/data/quotes.jsonl</code>. Back this file up daily, and delete a record
    only in response to a verified request from the customer. Personal data is retained for as long as it is
    needed to answer the enquiry and honour any guarantee.
  </footer>
</body>
</html>`

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'none'; base-uri 'none'",
    })
    res.end(html)
    return
  }

  /* ---------------------------------------------------------- content admin */

  if (path === '/admin/content' && req.method === 'GET') {
    if (!ADMIN_ENABLED) {
      send(res, 404, { ok: false, error: 'Unknown endpoint' })
      return
    }
    if (!isAdmin(req)) {
      demandAuth(res)
      return
    }
    const html = await renderContentAdminPage()
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'none'; base-uri 'none'",
    })
    res.end(html)
    return
  }

  if (path.startsWith('/api/admin/content')) {
    if (!ADMIN_ENABLED) {
      send(res, 404, { ok: false, error: 'Unknown endpoint' })
      return
    }
    if (!isAdmin(req)) {
      demandAuth(res)
      return
    }
    const handled = await handleAdminContentApi(req, res, path, send)
    if (handled) return
  }

  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  send(res, 404, { ok: false, error: 'Unknown endpoint' })
}

export function createEnquiryServer() {
  return createServer(handle)
}

const startedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (startedDirectly) {
  const server = createEnquiryServer()
  server.listen(PORT, '0.0.0.0', () => {
    log.info('service.started', {
      port: PORT,
      storage: DATA_DIR,
      staticDir: STATIC_DIR || null,
      notifications: configuredChannels(),
      inbox: ADMIN_ENABLED,
      errorForwarding: Boolean(process.env.OPD_SENTRY_DSN),
    })
    if (!configuredChannels().length) {
      // This is the difference between a lead pipeline and a text file. Say it
      // at startup, in the strongest terms that still respect the log format.
      log.warn('service.no_notification_channels', {
        detail:
          'Enquiries will be stored and shown in /admin, but nobody will be alerted. ' +
          'Set OPD_NOTIFY_WEBHOOK or OPD_RESEND_API_KEY + OPD_NOTIFY_EMAIL + OPD_NOTIFY_FROM.',
      })
    }
    if (!ADMIN_ENABLED) {
      log.info('service.inbox_disabled', { detail: 'set OPD_ADMIN_USER and OPD_ADMIN_PASSWORD to enable /admin' })
    }
  })
}
