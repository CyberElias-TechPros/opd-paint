/**
 * Vercel proxy tests — run with `npm test`.
 *
 * The deployment splits the site (Vercel) from the enquiry service (a container
 * with a real volume), and `app/api/[...path].js` is the seam between them. A seam
 * nobody tests is where production breaks, so this drives the actual handler
 * against the actual service over real HTTP.
 *
 *   node --test server/proxy.test.mjs
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const dataDir = mkdtempSync(join(tmpdir(), 'opd-proxy-'))
process.env.OPD_DATA_DIR = dataDir

// The module is loaded once; every test decides what OPD_API_ORIGIN is, because
// the handler reads it per request.
delete process.env.OPD_API_ORIGIN
const { default: proxy } = await import('../app/api/[...path].js')

const { createEnquiryServer } = await import('./index.mjs')

let service
let serviceUrl
let front
let frontUrl

before(async () => {
  service = createEnquiryServer()
  await new Promise((resolve) => service.listen(0, '127.0.0.1', resolve))
  serviceUrl = `http://127.0.0.1:${service.address().port}`

  // A front end that stands in for Vercel: every request is handed to the proxy.
  front = createServer((req, res) => {
    proxy(req, res).catch((error) => {
      res.statusCode = 500
      res.end(String(error))
    })
  })
  await new Promise((resolve) => front.listen(0, '127.0.0.1', resolve))
  frontUrl = `http://127.0.0.1:${front.address().port}`
})

after(async () => {
  await new Promise((resolve) => front.close(resolve))
  await new Promise((resolve) => service.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
  delete process.env.OPD_API_ORIGIN
})

const enquiry = {
  name: 'Ngozi Eze',
  phone: '0805 222 3333',
  city: 'Port Harcourt',
  projectType: 'exterior',
  message: 'Boundary wall and gate, roughly 60 metres.',
  consent: true,
}

test('without an origin the proxy refuses, and says so', async () => {
  delete process.env.OPD_API_ORIGIN
  const res = await fetch(`${frontUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enquiry),
  })
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.match(body.error, /not connected/i)
})

test('a GET is forwarded and the upstream status survives', async () => {
  process.env.OPD_API_ORIGIN = serviceUrl
  const res = await fetch(`${frontUrl}/api/health`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.data.service, 'opd-enquiries')
})

test('a POST with a JSON body reaches the service and creates a reference', async () => {
  process.env.OPD_API_ORIGIN = serviceUrl
  const res = await fetch(`${frontUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enquiry),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.match(body.data.reference, /^OPD-\d{6}-[0-9A-F]{4}$/)
  assert.equal(body.data.routedTo, 'Technical desk — exterior specification')
})

test('validation still happens behind the proxy — 422 with per-field messages', async () => {
  process.env.OPD_API_ORIGIN = serviceUrl
  const res = await fetch(`${frontUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...enquiry, phone: '123' }),
  })
  assert.equal(res.status, 422)
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.ok(body.fields.phone, 'expected a phone message')
})

test('the honeypot is still discarded silently', async () => {
  process.env.OPD_API_ORIGIN = serviceUrl
  const res = await fetch(`${frontUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...enquiry, company: 'spam-bot' }),
  })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
})

test('the query string is preserved', async () => {
  process.env.OPD_API_ORIGIN = serviceUrl
  const res = await fetch(`${frontUrl}/api/search/colours?q=bonny`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].id, 'bonny-haze')
})

test('service responses are never cacheable at the edge', async () => {
  process.env.OPD_API_ORIGIN = serviceUrl
  const res = await fetch(`${frontUrl}/api/health`)
  assert.equal(res.headers.get('cache-control'), 'no-store')
})

test('an unreachable origin becomes a 502 the visitor can act on', async () => {
  // Port 9 (discard) is closed on every sane machine; a refused connection is
  // the same shape as a service that is down.
  process.env.OPD_API_ORIGIN = 'http://127.0.0.1:9'
  const res = await fetch(`${frontUrl}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enquiry),
  })
  assert.equal(res.status, 502)
  const body = await res.json()
  assert.match(body.error, /0902 642 4350/)
})

test('a trailing slash on the origin does not double up the path', async () => {
  process.env.OPD_API_ORIGIN = `${serviceUrl}/`
  const res = await fetch(`${frontUrl}/api/health`)
  assert.equal(res.status, 200)
})
