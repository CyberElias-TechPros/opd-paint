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
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { log, requestId, describeError } from './logger.mjs'
import { configuredChannels, notifyEnquiry } from './notify.mjs'
import { recordError } from './errors.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The data directory is configurable so tests (and a staging box) can run
// against a scratch directory instead of the real enquiry log.
const DATA_DIR = process.env.OPD_DATA_DIR ? resolve(process.env.OPD_DATA_DIR) : join(__dirname, 'data')
const QUOTES_FILE = join(DATA_DIR, 'quotes.jsonl')
const SUBS_FILE = join(DATA_DIR, 'subscriptions.jsonl')
/**
 * Newsletter opt-outs (roadmap 1.4.11, NDPA section 34).
 *
 * A suppression record rather than a delete: the row has to survive so we can
 * show an address was honoured, and so re-subscribing is a deliberate, logged
 * act instead of a resurrected entry nobody agreed to.
 */
const UNSUBS_FILE = join(DATA_DIR, 'unsubscriptions.jsonl')
const PORT = Number(process.env.PORT ?? 8787)

/**
 * Cross-origin policy.
 *
 * `docs/deploying.md` describes the site calling this service across origins, so
 * the service has to say so in headers or a browser will throw the response
 * away — an enquiry that "succeeded" server-side and failed on screen. It is a
 * single allowed origin rather than `*`: enquiry bodies carry names and phone
 * numbers, and a wildcard lets any site read our responses on a visitor's
 * behalf. Unset means same-origin only, which is what the one-container
 * deployment in `docker-compose.yml` uses.
 */
const ALLOWED_ORIGIN = (process.env.OPD_ALLOWED_ORIGIN ?? '').replace(/\/+$/, '')

/**
 * How many proxy hops to believe, as a count of `X-Forwarded-For` entries taken
 * from the right.
 *
 * Rate limits and abuse logs keyed on the socket address are wrong behind a
 * reverse proxy or Docker networking — every visitor arrives from the gateway,
 * so the twelfth enquiry in ten minutes locks out the whole country. But the
 * header is visitor-controlled: nginx's usual `$proxy_add_x_forwarded_for`
 * *appends* to whatever the client sent, so reading the **first** entry lets
 * anybody rotate a rate limit by inventing addresses.
 *
 * Counting from the right is the fix, and the number is the number of proxies we
 * run: `true` (one hop — nginx or Docker in front of this service) reads the
 * address our own proxy appended; `2` reads the one a CDN handed it. Zero, the
 * default, trusts nothing but the socket.
 */
const TRUST_PROXY = (() => {
  const raw = (process.env.OPD_TRUST_PROXY ?? '').trim().toLowerCase()
  if (!raw) return 0
  if (['1', 'true', 'yes'].includes(raw)) return 1
  const hops = Number(raw)
  return Number.isInteger(hops) && hops > 0 ? Math.min(hops, 8) : 0
})()

// The enquiry inbox is only mounted when credentials are configured. An
// unauthenticated admin page is not a feature, it is an incident.
// Optionally serve the built site from this process, so a deployment is one
// container and one port. A reverse proxy in front is still a good idea for TLS
// and compression, but nothing here *requires* one.
const STATIC_DIR = process.env.OPD_STATIC_DIR ? resolve(process.env.OPD_STATIC_DIR) : ''

const ADMIN_USER = process.env.OPD_ADMIN_USER ?? ''
const ADMIN_PASSWORD = process.env.OPD_ADMIN_PASSWORD ?? ''
const ADMIN_ENABLED = Boolean(ADMIN_USER && ADMIN_PASSWORD)

/**
 * Colour index.
 *
 * `server/colour-index.json` is generated from `app/src/data/colors.ts` by
 * `tools/build-colour-index.mjs` during the build. Reading the TypeScript
 * source at request time — what this used to do — worked on a laptop and failed
 * in every deployment: the runtime container has `server/` and `app/dist`, not
 * the sources, so `/api/search/colours` answered 500 in production while its
 * tests, which run from the repository root, stayed green. The source parse is
 * kept as a fallback for a bare checkout that has not run the generator.
 */
const COLOUR_INDEX_FILE = process.env.OPD_COLOUR_INDEX
  ? resolve(process.env.OPD_COLOUR_INDEX)
  : join(__dirname, 'colour-index.json')
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

/* -------------------------------------------------------- colour index */

/**
 * The parsed index, cached against the file it came from.
 *
 * Search is a public, unauthenticated endpoint, so re-reading and re-parsing a
 * 60-entry file on every keystroke is needless work; keying the cache on mtime
 * and size means a regenerated index is picked up without a restart.
 */
let colourCache = { key: '', source: '', entries: [] }

async function readCached(file, source, parse) {
  const info = await stat(file)
  const key = `${info.mtimeMs}:${info.size}`
  if (colourCache.key === key && colourCache.source === source) return colourCache.entries
  const entries = parse(await readFile(file, 'utf8'))
  if (!entries.length) throw new Error(`${source} colour index is empty`)
  colourCache = { key, source, entries }
  return entries
}

const parseGeneratedIndex = (raw) => {
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed?.colours) ? parsed.colours : []
}

/**
 * Last-resort parse of the TypeScript library, for a checkout that has not run
 * the generator. Field order is fixed by the `c({ … })` entry shape; if that
 * shape changes the generated index still works and this returns nothing, which
 * is why the fallback is logged rather than trusted silently.
 */
const parseSourceIndex = (raw) =>
  [...raw.matchAll(/id:\s*'([^']+)',\s*code:\s*'([^']+)',\s*name:\s*'((?:[^'\\]|\\.)*)',\s*hex:\s*'([^']+)'/g)].map(
    ([, id, code, name, hex]) => ({ id, code, name, hex }),
  )

async function loadColourIndex() {
  try {
    return { source: 'generated', entries: await readCached(COLOUR_INDEX_FILE, 'generated', parseGeneratedIndex) }
  } catch {
    try {
      const entries = await readCached(COLOURS_FILE, 'source', parseSourceIndex)
      log.warn('search.colour_index_fallback', {
        detail: `${COLOUR_INDEX_FILE} was unreadable; parsed ${COLOURS_FILE} instead. Run tools/build-colour-index.mjs.`,
      })
      return { source: 'source', entries }
    } catch (error) {
      log.error('search.colour_index_unavailable', describeError(error))
      return null
    }
  }
}

/* ----------------------------------------------------- newsletter opt-out */

/**
 * Is this address on the suppression list?
 *
 * A retirement record (written when someone subscribes again with fresh consent)
 * cancels the most recent opt-out, so the answer is whatever the last record for
 * that address says. Case-insensitive, because `Ade@x.com` and `ade@x.com` are
 * the same mailbox and a suppression list that misses on case is not one.
 */
async function isSuppressed(email) {
  const target = String(email).toLowerCase()
  let suppressed = false
  for (const record of await readRecords(UNSUBS_FILE)) {
    if (String(record.email ?? '').toLowerCase() !== target) continue
    suppressed = !record.retired
  }
  return suppressed
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
  // Compared against the directory *plus a separator*: `startsWith(STATIC_DIR)`
  // on its own accepts a sibling such as `/srv/site-secret` when the root is
  // `/srv/site`, which is precisely the escape this check exists to prevent.
  if (candidate !== STATIC_DIR && !candidate.startsWith(STATIC_DIR + sep)) return false

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
  // The apostrophe matters: this output is interpolated into `tel:` and
  // `mailto:` hrefs and into single-quoted attributes, where `&#39;` is the
  // character that breaks out.
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

/**
 * Escape one CSV cell — against both parsing and injection.
 *
 * Quoting is the parsing half. The other half is that a desktop spreadsheet
 * executes a cell starting with `=`, `+`, `-`, `@`, tab or carriage return, and
 * an enquiry message is untrusted input that staff will open in Excel:
 * `=cmd|'/C calc'!A1` arrives as a formula, not text. Prefixing with a single
 * quote leaves the value readable and inert, which is the OWASP remedy for CSV
 * formula injection.
 */
function csvCell(value) {
  const text = Array.isArray(value)
    ? value.map((item) => csvText(item)).join(' | ')
    : csvText(value)
  return `"${text.replace(/"/g, '""')}"`
}

const csvText = (value) => {
  const text = String(value ?? '')
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
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

/**
 * The address to attribute a request to.
 *
 * Counted from the right of `X-Forwarded-For`, and only as far as
 * `OPD_TRUST_PROXY` says we run proxies — see that variable's note. Everything to
 * the left of that came from the client and is not evidence.
 */
function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean)
      const chosen = hops[hops.length - TRUST_PROXY] ?? hops[hops.length - 1]
      if (chosen) return chosen.replace(/^\[(.+)\]:\d+$/, '$1')
    }
    const real = req.headers['x-real-ip']
    if (typeof real === 'string' && real.trim()) return real.trim().replace(/^\[(.+)\]:\d+$/, '$1')
  }
  return req.socket.remoteAddress ?? 'unknown'
}

async function handle(req, res) {
  const ip = clientIp(req)
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

  // Cross-origin. Set before any response is written, because `writeHead` merges
  // with headers already set on the response — one place, every status code,
  // including the 422s and 429s a cross-origin form has to be able to read.
  const requestOrigin = req.headers.origin
  // API paths only. The admin inbox is same-origin by design — it is a page a
  // member of staff opens in a browser tab, not an endpoint another site calls —
  // so it gets no cross-origin permission, not even a 404 that carries one.
  if (path.startsWith('/api/') && ALLOWED_ORIGIN && typeof requestOrigin === 'string' && requestOrigin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '600')
    res.setHeader('Vary', 'Origin')
  }

  if (req.method === 'OPTIONS') {
    // A preflight is answered by the headers above; an empty 204 body and no
    // `Access-Control-Allow-Origin` is the worst of both worlds, which is what
    // this used to send. Preflighting is offered on API paths only — the admin
    // inbox is same-origin by design and should not appear to accept callers.
    if (path.startsWith('/api/')) {
      res.writeHead(204)
      res.end()
      return
    }
    send(res, 404, { ok: false, error: 'Unknown endpoint' })
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
    const found = await loadColourIndex()
    if (!found) {
      send(res, 503, { ok: false, error: 'Colour index unavailable' })
      return
    }
    const results = found.entries
      .filter((colour) => !q || `${colour.name} ${colour.code} ${colour.family ?? ''}`.toLowerCase().includes(q))
      .slice(0, 12)
    send(res, 200, { ok: true, results, count: results.length, index: found.source })
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

    // Which desk answers, and how fast. Computed once and stored on the record:
    // the client, the CSV export and the inbox all show it, and until now only
    // the response carried it — every stored enquiry read "Unrouted" in /admin
    // and the desk split was permanently blank.
    const routing = { routedTo: routeFor(projectType), slaHours: projectType === 'dealer' ? 48 : 24 }

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
      // Measured quantities from the calculator, so a desk quoting "3 × 20 L of
      // Matt for the lounge" is quoting the visitor's own numbers. Validated and
      // clamped like every other field: an amount is a number or it is dropped.
      quantities: Array.isArray(body.quantities)
        ? body.quantities
            .slice(0, 12)
            .map((item) => ({
              label: str(item?.label, 80),
              amount: Number(item?.amount) > 0 ? Math.min(Number(item.amount), 100000) : 0,
              unit: ['L', 'kg'].includes(str(item?.unit, 4)) ? str(item?.unit, 4) : 'L',
            }))
            .filter((item) => item.amount > 0)
        : [],
      ...routing,
      source: str(body.source, 60) || 'website',
      consent: { granted: true, at: new Date().toISOString(), basis: 'enquiry-reply' },
      meta: { ua: str(req.headers['user-agent'], 200) },
    }

    try {
      await ensureData()
      await appendFile(QUOTES_FILE, JSON.stringify(record) + '\n', 'utf8')

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
      // An address that opted out is not quietly re-added. The form requires the
      // consent checkbox, so a submission arriving here is fresh consent — but it
      // is recorded as such, and the suppression entry retired beside it.
      const wasSuppressed = await isSuppressed(email)
      const at = new Date().toISOString()
      await appendFile(
        SUBS_FILE,
        JSON.stringify({ email, interest: str(body.interest, 40), at, resubscribed: wasSuppressed }) + '\n',
        'utf8',
      )
      if (wasSuppressed) {
        await appendFile(UNSUBS_FILE, JSON.stringify({ email, at, retired: 'resubscribed' }) + '\n', 'utf8')
        log.info('newsletter.resubscribed', { detail: 'a suppressed address subscribed again with fresh consent' })
      }
      send(res, 201, { ok: true, data: { email, resubscribed: wasSuppressed } })
    } catch {
      send(res, 503, { ok: false, error: 'Subscription service unavailable.' })
    }
    return
  }

  if (req.method === 'POST' && path === '/api/unsubscribe') {
    // One click, from the same footer that offered the newsletter. "Unsubscribe
    // in one click" is printed under the sign-up form, and until this endpoint
    // existed it was not true — which is a consent failure, not a copy problem
    // (NDPA section 34: withdrawing consent must be as easy as giving it).
    if (rateLimited(`${ip}:unsubscribe`, 6)) {
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
      send(res, 422, { ok: false, error: 'Enter the email address you subscribed with.' })
      return
    }
    try {
      await ensureData()
      await appendFile(
        UNSUBS_FILE,
        JSON.stringify({
          email,
          at: new Date().toISOString(),
          source: str(body.source, 40) || 'footer',
          reason: str(body.reason, 120) || null,
        }) + '\n',
        'utf8',
      )
      log.info('newsletter.unsubscribed', { source: str(body.source, 40) || 'footer' })
      // 201, not 204: the visitor gets a confirmation and the record is durable.
      send(res, 201, { ok: true, data: { email } })
    } catch {
      send(res, 503, { ok: false, error: 'We could not record that. Email hello@opudaspaint.com and we will remove you by hand.' })
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
        'rooms', 'colors', 'products', 'quantities', 'routedTo', 'slaHours', 'message', 'source',
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
            ${(record.quantities ?? []).length
              ? `<div class="muted">Quantities: ${escapeHtml(
                  (record.quantities ?? [])
                    .map((item) => `${item.label}: ${item.amount} ${item.unit}`)
                    .join(', '),
                )}</div>`
              : ''}
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
