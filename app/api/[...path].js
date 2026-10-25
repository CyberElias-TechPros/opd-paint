/**
 * `/api/*` on Vercel — a transparent proxy to the enquiry service.
 *
 * Vercel hosts the *site*. It cannot host the enquiry service, for one blunt
 * reason: a serverless function has no durable filesystem, and the enquiry log
 * is the only thing in this project that must survive. Burying a lead in a
 * warm container's /tmp is worse than having no form at all.
 *
 * So the site and the service are deployed separately:
 *
 *     browser ──▶ Vercel (static site + this proxy) ──▶ OPD_API_ORIGIN
 *
 * That keeps one implementation of validation, routing, rate limiting and the
 * inbox, keeps the data on a volume that is actually backed up, and means the
 * preview deployment exercises the real service rather than a mock.
 *
 * Configure `OPD_API_ORIGIN` in the Vercel project (for example
 * `https://api.opudapaint.com`). With it unset the proxy answers 503 with a
 * readable body, and the client already degrades to the phone number — a
 * preview without a backend must not pretend to accept enquiries.
 *
 * Deliberately dependency-free ES module: this file is compiled and run by the
 * platform, not by the app's build, so it must not rely on anything in
 * app/node_modules. It lives under `app/` because that is this project's Root
 * Directory on Vercel — the platform only picks up functions from there.
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // Let the platform decide these, not the upstream service.
  'content-length',
  'host',
])

/** Vercel hands us a parsed body for some content types and a stream for others. */
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body
    if (typeof req.body === 'string') return Buffer.from(req.body)
    return Buffer.from(JSON.stringify(req.body))
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function fail(res, status, message) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ ok: false, error: message }))
}

export default async function handler(req, res) {
  const origin = (process.env.OPD_API_ORIGIN || '').trim().replace(/\/+$/, '')

  if (!origin) {
    fail(res, 503, 'The enquiry service is not connected to this deployment.')
    return
  }

  // Rebuild the path from the catch-all. On a rewrite the original URL is still
  // the browser's; on a direct call the query string rides along either way.
  const incoming = req.url || '/'
  const path = incoming.startsWith('/api/') ? incoming : `/api${incoming.startsWith('/') ? '' : '/'}${incoming}`

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = value
  }
  headers['x-forwarded-host'] = req.headers.host || ''

  const method = req.method || 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'

  let upstream
  try {
    upstream = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: hasBody ? await readBody(req) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    // A timeout or an unreachable service is a real outage; say so plainly so
    // the client can fall back to the phone number instead of retrying blindly.
    fail(res, 502, 'The enquiry service could not be reached. Please call 0902 642 4350.')
    console.error('[proxy] upstream error', { path, message: String(error) })
    return
  }

  res.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value)
  })
  // Responses from the service are per-visitor and must never be cached at the edge.
  res.setHeader('Cache-Control', 'no-store')

  const body = Buffer.from(await upstream.arrayBuffer())
  res.end(body)
}

// The platform must not parse the body for us: the service validates the raw
// bytes and enforces its own 32 KB limit, and a 413 from here would bypass the
// readable message the browser shows.
export const config = {
  api: {
    bodyParser: false,
  },
}
