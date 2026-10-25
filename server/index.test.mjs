/**
 * Enquiry service tests — run with `npm test`.
 *
 * These exercise the real HTTP surface, not the handler in isolation: validation
 * codes, the honeypot's silent discard, the rate limiter, and the fact that the
 * inbox cannot be read without credentials.
 *
 *   node --test server/
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = mkdtempSync(join(tmpdir(), 'opd-test-'))
process.env.OPD_DATA_DIR = dataDir
process.env.OPD_ADMIN_USER = 'desk'
process.env.OPD_ADMIN_PASSWORD = 'correct horse battery'

// Import after the environment is set: the module reads it at load time.
const { createEnquiryServer } = await import('./index.mjs')

let server
let base

before(async () => {
  server = createEnquiryServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
})

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const validEnquiry = {
  name: 'Ade Balogun',
  phone: '0803 123 4567',
  city: 'Port Harcourt',
  projectType: 'interior',
  rooms: '4',
  message: 'Whole flat repaint, moving in on the 14th.',
  consent: true,
  colors: ['OP-001', 'OP-209'],
  products: ['OPD-MT'],
}

test('health reports the service and an uptime', async () => {
  const res = await fetch(`${base}/api/health`)
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.data.service, 'opd-enquiries')
  assert.equal(typeof body.data.uptime, 'number')
})

test('a valid enquiry returns 201 with a reference and a routed desk', async () => {
  const res = await post('/api/quotes', validEnquiry)
  const body = await res.json()
  assert.equal(res.status, 201)
  assert.match(body.data.reference, /^OPD-\d{6}-[0-9A-F]{4}$/)
  assert.equal(body.data.slaHours, 24)
  assert.match(body.data.routedTo, /Colour desk/)
})

test('the enquiry is persisted with its colours and products', async () => {
  const file = join(dataDir, 'quotes.jsonl')
  assert.ok(existsSync(file), 'quotes.jsonl was not created')
  const records = readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  const record = records.find((entry) => entry.name === 'Ade Balogun')
  assert.ok(record, 'record missing from the log')
  assert.deepEqual(record.colors, ['OP-001', 'OP-209'])
  assert.deepEqual(record.products, ['OPD-MT'])
  assert.ok(record.receivedAt, 'missing timestamp')
})

test('an empty submission is rejected field by field', async () => {
  const res = await post('/api/quotes', {})
  const body = await res.json()
  assert.equal(res.status, 422)
  assert.equal(body.ok, false)
  for (const field of ['name', 'phone', 'city', 'projectType', 'consent']) {
    assert.ok(body.fields[field], `no message for ${field}`)
  }
})

test('an unreachable phone number is rejected', async () => {
  const res = await post('/api/quotes', { ...validEnquiry, phone: '123' })
  assert.equal(res.status, 422)
  assert.ok((await res.json()).fields.phone)
})

test('a bad email is rejected when one is supplied', async () => {
  const res = await post('/api/quotes', { ...validEnquiry, email: 'not-an-email' })
  assert.equal(res.status, 422)
  assert.ok((await res.json()).fields.email)
})

test('the honeypot looks successful but stores nothing', async () => {
  const before = readFileSync(join(dataDir, 'quotes.jsonl'), 'utf8').trim().split('\n').length
  const res = await post('/api/quotes', { ...validEnquiry, name: 'Spam Bot', company: 'spam.example' })
  const after = readFileSync(join(dataDir, 'quotes.jsonl'), 'utf8').trim().split('\n').length
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
  assert.equal(after, before, 'a honeypot submission was written to the log')
})

test('trade and sample enquiries route to a different desk from a colour question', async () => {
  const trade = await (await post('/api/quotes', { ...validEnquiry, projectType: 'trade' })).json()
  const sample = await (await post('/api/quotes', { ...validEnquiry, projectType: 'sample' })).json()
  const dealer = await (await post('/api/quotes', { ...validEnquiry, projectType: 'dealer' })).json()

  assert.match(trade.data.routedTo, /Trade/)
  assert.match(sample.data.routedTo, /Sample/)
  assert.match(dealer.data.routedTo, /dealer/i)
  assert.equal(dealer.data.slaHours, 48)
})

test('malformed JSON is a 400, not a crash', async () => {
  const res = await fetch(`${base}/api/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ not json',
  })
  assert.equal(res.status, 400)
})

test('an oversized payload is refused', async () => {
  const res = await post('/api/quotes', { ...validEnquiry, message: 'x'.repeat(200_000) })
  assert.ok([400, 413].includes(res.status), `unexpected status ${res.status}`)
})

test('subscription validates the address and stores it', async () => {
  const bad = await post('/api/subscribe', { email: 'nope' })
  assert.equal(bad.status, 422)

  const good = await post('/api/subscribe', { email: 'reader@example.com', interest: 'guides' })
  assert.equal(good.status, 201)
  const file = join(dataDir, 'subscriptions.jsonl')
  assert.match(readFileSync(file, 'utf8'), /reader@example\.com/)
})

test('colour search answers with codes and names', async () => {
  const res = await fetch(`${base}/api/search/colours?q=palm`)
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(body.results))
  assert.ok(body.results.some((colour) => /palm/i.test(colour.name)))
})

test('unknown endpoints 404', async () => {
  const res = await fetch(`${base}/api/nope`)
  assert.equal(res.status, 404)
})

test('the inbox refuses anonymous readers', async () => {
  const res = await fetch(`${base}/admin`)
  assert.equal(res.status, 401)
  assert.match(res.headers.get('www-authenticate') ?? '', /Basic/)
})

test('the inbox refuses the wrong password', async () => {
  const res = await fetch(`${base}/admin`, {
    headers: { Authorization: `Basic ${Buffer.from('desk:wrong').toString('base64')}` },
  })
  assert.equal(res.status, 401)
})

test('the inbox shows enquiries to an authenticated reader', async () => {
  const auth = `Basic ${Buffer.from('desk:correct horse battery').toString('base64')}`
  const res = await fetch(`${base}/admin`, { headers: { Authorization: auth } })
  const html = await res.text()
  assert.equal(res.status, 200)
  assert.match(html, /Ade Balogun/)
  assert.match(html, /OPD-/)
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/)
})

test('the CSV export is downloadable and escapes text', async () => {
  const auth = `Basic ${Buffer.from('desk:correct horse battery').toString('base64')}`
  await post('/api/quotes', { ...validEnquiry, name: 'Quote "and" comma, test' })
  const res = await fetch(`${base}/admin/enquiries.csv`, { headers: { Authorization: auth } })
  const csv = await res.text()
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-disposition') ?? '', /attachment/)
  assert.match(csv.split('\n')[0], /^reference,receivedAt,name/)
  assert.match(csv, /"Quote ""and"" comma, test"/)
})

test('the inbox does not exist when no credentials are configured', () => {
  const script = `
    const { createEnquiryServer } = await import(${JSON.stringify(fileURLToPath(new URL('./index.mjs', import.meta.url)))})
    const server = createEnquiryServer()
    server.listen(0, '127.0.0.1', async () => {
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/admin')
      // Tagged, because the service now logs to stdout as well and the status
      // must not be read out of a log line.
      process.stdout.write('STATUS=' + res.status)
      server.close()
    })
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, OPD_ADMIN_USER: '', OPD_ADMIN_PASSWORD: '', OPD_DATA_DIR: dataDir },
    encoding: 'utf8',
  })
  assert.match(result.stdout, /STATUS=404\b/, 'an unconfigured inbox answered')
})

// Last, because it deliberately exhausts the limiter for this address.
test('rate limiting kicks in after twelve submissions from one address', async () => {
  let sawLimit = false
  for (let i = 0; i < 16; i += 1) {
    const res = await post('/api/quotes', { ...validEnquiry, name: `Limit ${i}` })
    if (res.status === 429) {
      sawLimit = true
      break
    }
  }
  assert.equal(sawLimit, true, 'the limiter never triggered')
})
