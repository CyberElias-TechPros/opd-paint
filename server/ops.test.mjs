/**
 * Operational tests: notifications, error intake, and the health check.
 *
 * The properties under test are the ones that decide whether this is a lead
 * pipeline or a text file:
 *
 *  · an enquiry is answered *before* any notification is attempted, so a slow
 *    or dead webhook cannot make a submission feel broken;
 *  · a failed notification never fails the enquiry, and is recorded;
 *  · error reports are stored without personal data, whatever the client sends;
 *  · the health check tells an operator what is and is not wired up.
 *
 *   node --test server/ops.test.mjs
 */
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Environment first: `notify.mjs` reads its retry schedule at import time, so
// these must be set before any of the service modules are loaded. Everything
// under test is therefore imported dynamically — a static import here would be
// hoisted above this block and silently use the production defaults.
const dataDir = mkdtempSync(join(tmpdir(), 'opd-ops-'))
process.env.OPD_DATA_DIR = dataDir
process.env.OPD_LOG_LEVEL = 'error' // keep the test output readable
process.env.OPD_NOTIFY_RETRY_MS = '0' // do not sleep through retries

const { createEnquiryServer } = await import('./index.mjs')
const { sanitise } = await import('./errors.mjs')
const { summarise } = await import('./notify.mjs')

let service
let base
let hook
let hookUrl
const received = []
let hookStatus = 202

before(async () => {
  service = createEnquiryServer()
  await new Promise((resolve) => service.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${service.address().port}`

  // A stand-in for Slack/Zapier/whatever the desk uses.
  hook = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      received.push({ url: req.url, body: Buffer.concat(chunks).toString('utf8'), headers: req.headers })
      res.statusCode = hookStatus
      res.end(hookStatus < 300 ? 'ok' : 'nope')
    })
  })
  await new Promise((resolve) => hook.listen(0, '127.0.0.1', resolve))
  hookUrl = `http://127.0.0.1:${hook.address().port}/hook`
})

after(async () => {
  await new Promise((resolve) => hook.close(resolve))
  await new Promise((resolve) => service.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
})

beforeEach(() => {
  received.length = 0
  hookStatus = 202
  delete process.env.OPD_NOTIFY_WEBHOOK
})

const enquiry = (overrides = {}) => ({
  name: 'Chidi Okwu',
  phone: '0807 111 2222',
  city: 'Port Harcourt',
  projectType: 'interior',
  message: 'Two bedrooms and a sitting room.',
  consent: true,
  ...overrides,
})

const submit = (body) =>
  fetch(`${base}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/**
 * Wait for a JSONL file to reach `count` lines. Polling beats a fixed sleep:
 * it is both faster when delivery is quick and reliable when CI is slow.
 */
async function waitForLines(file, count, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
      if (lines.length >= count) return lines.map((line) => JSON.parse(line))
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return existsSync(file)
    ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    : []
}

/** Notifications are fire-and-forget; wait for the audit trail to settle. */
const settle = (count) => waitForLines(join(dataDir, 'notifications.jsonl'), count)

/* ------------------------------------------------------------ notifications */

test('an enquiry is answered immediately, and the webhook is told afterwards', async () => {
  process.env.OPD_NOTIFY_WEBHOOK = hookUrl

  const started = Date.now()
  const res = await submit(enquiry({ name: 'First Light' }))
  const elapsed = Date.now() - started

  assert.equal(res.status, 201)
  assert.ok(elapsed < 1500, `the response waited on the webhook (${elapsed}ms)`)

  const audit = await settle(1)
  assert.equal(audit.length, 1)
  assert.deepEqual(audit[0].results, [{ channel: 'webhook', ok: true }])
  assert.equal(received.length, 1, 'the webhook was called more than once')

  const payload = JSON.parse(received[0].body)
  assert.match(payload.text, /New interior enquiry — OPD-\d{6}-[0-9A-F]{4}/)
  assert.match(payload.text, /First Light · 0807 111 2222/)
  assert.match(payload.text, /Routed to: Colour desk — Port Harcourt \(24h SLA\)/)
  assert.equal(payload.record.city, 'Port Harcourt')
  assert.ok(payload.record.reference)
  assert.equal(payload.source, "OPUDA'S PAINT website")
})

test('a dead webhook does not fail the enquiry, and the failure is recorded', async () => {
  process.env.OPD_NOTIFY_WEBHOOK = `${hookUrl}?boom`
  hookStatus = 500

  const res = await submit(enquiry({ name: 'Second Light' }))
  assert.equal(res.status, 201, 'the visitor must still get their reference')

  const audit = await settle(2)
  const failed = audit.find((entry) => entry.results.some((result) => result.channel === 'webhook' && !result.ok))
  assert.ok(failed, 'the failed delivery was not recorded')
  assert.match(failed.results[0].error, /HTTP 500/)
  assert.ok(received.length >= 2, 'a failed delivery should have been retried')
})

test('with no channel configured the enquiry still works and nothing is attempted', async () => {
  const before = received.length
  const res = await submit(enquiry({ name: 'Third Light' }))
  assert.equal(res.status, 201)

  // Give a stray delivery time to appear; nothing should.
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.equal(received.length, before, 'a webhook was called with no channel configured')
})

test('the notification text is written for a phone screen', () => {
  const text = summarise(
    {
      reference: 'OPD-261025-ABCD',
      projectType: 'trade',
      name: 'Ada',
      phone: '0802 000 0000',
      city: 'Rumuokoro',
      message: 'Twelve flats.',
      colors: ['OP-001', 'OP-209'],
      products: [],
      email: 'ada@example.com',
    },
    { routedTo: 'Trade & contracts desk', slaHours: 24 },
  )
  const lines = text.split('\n')
  assert.match(lines[0], /OPD-261025-ABCD/)
  assert.match(text, /Trade & contracts desk \(24h SLA\)/)
  assert.match(text, /Colours: OP-001, OP-209/)
  assert.doesNotMatch(text, /Products:/, 'empty sections should be omitted')
})

/* --------------------------------------------------------------- error intake */

test('an error report is accepted and stored', async () => {
  const res = await fetch(`${base}/api/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'boundary',
      message: 'Cannot read properties of undefined',
      stack: 'Error: boom\n  at Home (Home.tsx:12)',
      path: '/colours?email=ada@example.com',
      userAgent: 'Mozilla/5.0',
    }),
  })
  assert.equal(res.status, 202)
  const body = await res.json()
  assert.match(body.data.eventId, /^[0-9a-f]{32}$/)

  await settle()
  const line = readFileSync(join(dataDir, 'errors.jsonl'), 'utf8').trim().split('\n').pop()
  const stored = JSON.parse(line)
  assert.equal(stored.kind, 'boundary')
  assert.equal(stored.message, 'Cannot read properties of undefined')
  // The query string is dropped, so a pre-filled email cannot land in a log.
  assert.equal(stored.path, '/colours')
  assert.equal(stored.ip, '127.0.0.1')
})

test('personal data is scrubbed out of an error report, not stored', () => {
  const event = sanitise({
    message: 'Failed for ada@example.com on 08031234567',
    path: '/quote?email=ada@example.com&phone=08031234567',
    stack: 'Error at ada@example.com',
    extra: { email: 'ada@example.com', phone: '08031234567', password: 'hunter2', chunk: 'main-abc.js' },
  })
  assert.equal(event.message, 'Failed for [email] on [number]')
  assert.equal(event.path, '/quote')
  assert.doesNotMatch(event.stack, /ada@example\.com/)
  assert.equal(event.extra.email, undefined, 'a key named email must be refused outright')
  assert.equal(event.extra.password, undefined)
  assert.equal(event.extra.chunk, 'main-abc.js')
})

test('an oversized or malformed error report is rejected without echoing it back', async () => {
  const tooBig = await fetch(`${base}/api/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'x'.repeat(20_000) }),
  })
  assert.equal(tooBig.status, 413)
  const body = await tooBig.json()
  assert.doesNotMatch(JSON.stringify(body), /xxxx/)

  const garbage = await fetch(`${base}/api/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  })
  assert.equal(garbage.status, 400)
})

/* -------------------------------------------------------------------- health */

test('health reports capability without leaking configuration', async () => {
  const res = await fetch(`${base}/api/health`)
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(body.data.service, 'opd-enquiries')
  assert.ok(Array.isArray(body.data.notifications))
  assert.equal(typeof body.data.inbox, 'boolean')
  assert.equal(typeof body.data.errorForwarding, 'boolean')
  assert.equal(typeof body.data.uptime, 'number')

  // No URLs, no credentials, no paths.
  const serialised = JSON.stringify(body)
  assert.doesNotMatch(serialised, /http:\/\//)
  assert.doesNotMatch(serialised, /hook/)
  assert.doesNotMatch(serialised, /port/i)
})

test('the health check names the channels that are actually live', async () => {
  process.env.OPD_NOTIFY_WEBHOOK = hookUrl
  const withWebhook = await (await fetch(`${base}/api/health`)).json()
  assert.deepEqual(withWebhook.data.notifications, ['webhook'])

  delete process.env.OPD_NOTIFY_WEBHOOK
  const without = await (await fetch(`${base}/api/health`)).json()
  assert.deepEqual(without.data.notifications, [])
})

test('every API response carries a request id', async () => {
  const res = await fetch(`${base}/api/health`)
  assert.match(res.headers.get('x-request-id') ?? '', /^[a-z0-9]{8}$/)
})

test('health counts damaged records, so a truncated write cannot hide', async () => {
  const before = await (await fetch(`${base}/api/health`)).json()
  assert.equal(before.data.damagedRecords, 0, 'a clean log should report no damage')

  appendFileSync(join(dataDir, 'quotes.jsonl'), '{"reference":"OPD-261025-TRUNC","receivedAt":"2026-1')

  const after = await (await fetch(`${base}/api/health`)).json()
  assert.equal(after.data.damagedRecords, 1, 'a truncated line should be counted')
})
