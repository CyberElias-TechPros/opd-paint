/**
 * What the customer gets, and what the customer can ask for.
 *
 * Run with `npm test`.
 *
 * Three behaviours live here because all three are about the person on the other
 * side of the form rather than the desk:
 *
 *   • the acknowledgement (roadmap 14.02.05) — a reference number promised on
 *     screen and then silence is a form people do not trust, so the service sends
 *     the visitor their own reference back;
 *   • duplicate suppression (roadmap 14.01.05) — a double click used to write two
 *     records for the desk and hand the customer two references to quote;
 *   • data-subject requests (roadmap 16.03.07, NDPA sections 30–36) — the privacy
 *     notice promises a right of access, correction and deletion answered within
 *     30 days, and a promise with no intake path has no clock on it.
 *
 * Both outbound channels are pointed at local servers, so these tests assert what
 * the service actually sends rather than what it intended to send. `OPD_RESEND_URL`
 * exists for exactly this: the default is Resend, and a test should not have to
 * reach a vendor to prove the message is right.
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = mkdtempSync(join(tmpdir(), 'opd-privacy-'))

/* ------------------------------------------------------- the far ends */

/** Everything the service sent, in the order it sent it. */
const sent = []
let mailStatus = 200

const mail = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', () => {
    sent.push({ where: 'mail', headers: req.headers, body: JSON.parse(body || '{}') })
    res.writeHead(mailStatus, { 'Content-Type': 'application/json' })
    res.end(mailStatus === 200 ? '{"id":"msg_test"}' : '{"message":"provider down"}')
  })
})

const hooks = []
const hook = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', () => {
    hooks.push(JSON.parse(body || '{}'))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{"ok":true}')
  })
})

await new Promise((resolve) => mail.listen(0, '127.0.0.1', resolve))
await new Promise((resolve) => hook.listen(0, '127.0.0.1', resolve))

process.env.OPD_DATA_DIR = dataDir
process.env.OPD_LOG_LEVEL = 'error'
process.env.OPD_LOG_FORMAT = 'json'
process.env.OPD_NOTIFY_RETRY_MS = '5,10'
process.env.OPD_RESEND_API_KEY = 're_test_not_a_real_key'
process.env.OPD_NOTIFY_EMAIL = 'desk@opudapaint.com'
process.env.OPD_NOTIFY_FROM = "OPUDA'S PAINT <no-reply@opudapaint.com>"
process.env.OPD_RESEND_URL = `http://127.0.0.1:${mail.address().port}/emails`
process.env.OPD_NOTIFY_WEBHOOK = `http://127.0.0.1:${hook.address().port}/hook`

const { createEnquiryServer } = await import('./index.mjs')
const { acknowledgementText, notifyCustomer } = await import('./notify.mjs')

const server = createEnquiryServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => mail.close(resolve))
  await new Promise((resolve) => hook.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
})

/**
 * Empty the limiter between tests.
 *
 * Every request here comes from 127.0.0.1, and the limits are shared and durable
 * — which is the whole point of them. A suite that posted a dozen data-subject
 * requests from one address would otherwise spend the production budget of three
 * in its first two tests. Truncating the file works because the store re-reads
 * when the file changes underneath it, which is the same thing that lets two
 * instances share one allowance.
 */
const resetLimits = () => {
  try {
    writeFileSync(join(dataDir, 'limits.jsonl'), '', 'utf8')
  } catch {
    // Nothing to clear yet.
  }
}

const lines = (file) => {
  try {
    return readFileSync(join(dataDir, file), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** Notifications are fired after the response, so a test has to wait for them. */
const waitFor = async (predicate, { timeout = 3000, label = 'condition' } = {}) => {
  const started = Date.now()
  for (;;) {
    const value = predicate()
    if (value) return value
    if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const emailsTo = (address) => sent.filter((entry) => entry.where === 'mail' && (entry.body.to ?? []).includes(address))

let visit = 0
/** A different person every time, so duplicate suppression is not tripped by accident. */
const enquiry = (overrides = {}) => ({
  name: `Test Visitor ${visit}`,
  email: `visitor${visit}@example.com`,
  phone: `0803 000 ${String(1000 + visit).slice(-4)}`,
  city: 'Port Harcourt',
  projectType: 'interior',
  rooms: '2 bedrooms',
  message: `Repainting before the rains (#${visit}).`,
  consent: true,
  colors: ['OP-001'],
  ...overrides,
})

/* ------------------------------------------- the acknowledgement, delivered */

test('the visitor gets their own reference back, by email, once', async () => {
  resetLimits()
  const payload = enquiry()
  visit += 1
  const res = await post('/api/quotes', payload)
  assert.equal(res.status, 201)
  const body = await res.json()
  const reference = body.data.reference

  const message = await waitFor(() => emailsTo(payload.email).at(-1), { label: 'the acknowledgement' })
  assert.match(message.body.subject, new RegExp(reference), 'the subject carries the reference the screen showed')
  assert.equal(message.body.from, process.env.OPD_NOTIFY_FROM)
  assert.equal(message.headers.authorization, `Bearer ${process.env.OPD_RESEND_API_KEY}`)

  const text = message.body.text
  assert.match(text, /Hello Test,/, 'it greets the person by their first name, not "Dear Customer"')
  assert.match(text, new RegExp(reference))
  assert.match(text, /Colour desk/, 'it says which desk has it')
  assert.match(text, /24 hours/, 'and repeats the commitment the site makes')
  assert.match(text, /0902 642 4350/, 'and the number to call if it is urgent')
  assert.match(text, /not a quotation/, 'the estimate is still an estimate')
  assert.match(text, /hello@opudapaint\.com/, 'the data-subject route is in the message itself')
  assert.match(text, /30 days/, 'with the deadline the privacy notice promises')
  assert.match(text, /not a newsletter/, 'and it says plainly that nothing else will follow')
  assert.doesNotMatch(text, /[₦$£]\s?\d/, 'no price, because the site publishes none')
  assert.doesNotMatch(text, /re_test_not_a_real_key/, 'and no credential leaked into the body')

  const audit = await waitFor(() => lines('notifications.jsonl').find((entry) => entry.kind === 'acknowledgement'), {
    label: 'the audit line',
  })
  assert.equal(audit.reference, reference)
  assert.equal(audit.results[0].ok, true)
  assert.ok(!('email' in audit) && !('to' in audit), 'the audit line records that a message went, not a second copy of the address')
})

test('a duplicate submission gets the same reference and no second email', async () => {
  resetLimits()
  const payload = enquiry()
  visit += 1

  const first = await (await post('/api/quotes', payload)).json()
  const second = await post('/api/quotes', payload)
  assert.equal(second.status, 201, 'a repeat is not an error the visitor has to interpret')
  const body = await second.json()

  assert.equal(body.data.reference, first.data.reference, 'one enquiry, one reference')
  assert.equal(body.data.duplicate, true, 'and the client is told it was a repeat, so it can say so')
  assert.equal(body.data.receivedAt, first.data.receivedAt)

  await waitFor(() => emailsTo(payload.email).length >= 1, { label: 'the first acknowledgement' })
  const stored = lines('quotes.jsonl').filter((record) => record.email === payload.email)
  assert.equal(stored.length, 1, `the desk sees one record, not two (saw ${stored.length})`)
  assert.equal(emailsTo(payload.email).length, 1, 'and the visitor is not emailed twice for one question')
})

test('a changed detail makes it a different enquiry', async () => {
  resetLimits()
  const payload = enquiry()
  visit += 1
  const first = await (await post('/api/quotes', payload)).json()
  const second = await (await post('/api/quotes', { ...payload, rooms: '3 bedrooms' })).json()

  assert.notEqual(second.data.reference, first.data.reference, 'a different room count is a different job')
  assert.ok(!second.data.duplicate)
  assert.equal(lines('quotes.jsonl').filter((record) => record.email === payload.email).length, 2)
})

test('a phone-only enquiry is answered by phone, and that is not a failure', async () => {
  resetLimits()
  const payload = enquiry({ email: '', phone: '0803 555 0101' })
  visit += 1
  const before = sent.length

  const res = await post('/api/quotes', payload)
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.ok(body.data.reference, 'it still gets a reference to quote on the phone')

  // The desk still hears about it; only the customer's copy is skipped.
  await waitFor(() => hooks.some((entry) => entry.record?.reference === body.data.reference), { label: 'the desk alert' })
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(
    sent.slice(before).filter((entry) => entry.where === 'mail' && (entry.body.to ?? []).includes('')).length,
    0,
    'nothing is sent to an address that was never given',
  )
  assert.deepEqual(await notifyCustomer({ reference: 'OPD-TEST', name: 'Nobody' }, null), {
    sent: false,
    reason: 'no-address',
  })
})

test('the acknowledgement can be switched off without touching anything else', async () => {
  resetLimits()
  process.env.OPD_ACK_CUSTOMER = 'off'
  try {
    const payload = enquiry()
    visit += 1
    const before = emailsTo(payload.email).length

    const res = await post('/api/quotes', payload)
    assert.equal(res.status, 201)
    const body = await res.json()
    await waitFor(() => hooks.some((entry) => entry.record?.reference === body.data.reference), { label: 'the desk alert' })
    await new Promise((resolve) => setTimeout(resolve, 60))

    assert.equal(emailsTo(payload.email).length, before, 'no message goes to the visitor')
    assert.deepEqual(await notifyCustomer({ reference: 'OPD-TEST', name: 'Nobody', email: 'a@b.com' }, null), {
      sent: false,
      reason: 'disabled',
    })
  } finally {
    delete process.env.OPD_ACK_CUSTOMER
  }
})

test('a mail provider that is down costs the business, not the customer', async () => {
  resetLimits()
  mailStatus = 500
  const payload = enquiry()
  visit += 1
  try {
    const res = await post('/api/quotes', payload)
    assert.equal(res.status, 201, 'the enquiry is accepted whether or not the email goes out')
    const body = await res.json()
    assert.ok(body.data.reference)
    assert.ok(!body.data.duplicate)

    const failure = await waitFor(
      () => lines('notifications.jsonl').find((entry) => entry.reference === body.data.reference && entry.kind === 'acknowledgement'),
      { label: 'the failed acknowledgement to be recorded', timeout: 6000 },
    )
    assert.equal(failure.results[0].ok, false, 'the failure is written down')
    assert.ok(failure.results[0].error, 'and it says what went wrong')

    const health = await (await fetch(`${base}/api/health`)).json()
    const channel = health.data.notificationHealth.acknowledgement
    assert.equal(channel.ok, false, 'health now says the channel is not working')
    assert.ok(channel.consecutiveFailures >= 1)
    assert.ok(channel.lastFailureAt, 'and when it last failed')
    assert.ok(channel.delivered >= 1, 'earlier successes are still counted, so the trend is visible')
    assert.ok(
      lines('quotes.jsonl').some((record) => record.reference === body.data.reference),
      'and the enquiry itself is on disk, which is the part that must never be lost',
    )
  } finally {
    mailStatus = 200
  }
})

/* ------------------------------------------------- data-subject requests */

test('a right exercised is recorded, referenced and given a deadline', async () => {
  resetLimits()
  const res = await post('/api/privacy', {
    type: 'erasure',
    email: 'ade@example.com',
    enquiryReference: 'OPD-261103-4K2P',
    note: 'Please delete everything you hold about me, including the enquiry from last month.',
    source: 'privacy-page',
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.match(body.data.reference, /^DSAR-\d{6}-[A-F0-9]{4}$/, 'its own reference series, so it cannot be confused with an enquiry')

  const due = Date.parse(body.data.dueBy)
  const days = (due - Date.now()) / 86_400_000
  assert.ok(days > 29.9 && days < 30.1, `the statutory clock is stated (${days.toFixed(2)} days)`)

  const record = await waitFor(() => lines('privacy-requests.jsonl').find((entry) => entry.reference === body.data.reference), {
    label: 'the stored request',
  })
  assert.equal(record.type, 'erasure')
  assert.equal(record.email, 'ade@example.com')
  assert.equal(record.enquiryReference, 'OPD-261103-4K2P')
  assert.equal(record.basis, 'data-subject-right', 'a right is not a consent, and the record says which')
  assert.match(record.note, /delete everything/)
})

test('the desk is told about a request, and told about the clock', async () => {
  resetLimits()
  const res = await post('/api/privacy', { type: 'access', email: 'grace@example.com' })
  const body = await res.json()

  const alert = await waitFor(() => hooks.find((entry) => entry.kind === 'privacy-request' && entry.record?.reference === body.data.reference), {
    label: 'the desk alert',
  })
  assert.match(alert.text, /Right exercised: access/)
  assert.match(alert.text, /30 days/, 'the deadline travels with the request, because it is the part that gets missed')
  assert.match(alert.text, /grace@example\.com/, 'and so does the address to answer at')

  const message = await waitFor(() => sent.find((entry) => entry.where === 'mail' && entry.body.subject?.includes(body.data.reference)), {
    label: 'the desk email',
  })
  assert.match(message.body.subject, /Data-subject request DSAR-/, 'the subject says what it is before it is opened')
  assert.deepEqual(message.body.reply_to, 'grace@example.com', 'replying answers the requester, not the desk')
})

test('a request that names no right, or no way to answer, is not accepted', async () => {
  resetLimits()
  const noRight = await post('/api/privacy', { email: 'ade@example.com' })
  assert.equal(noRight.status, 422)
  const body = await noRight.json()
  assert.ok(body.fields.type, 'the field that is missing is named')

  const noAddress = await post('/api/privacy', { type: 'access' })
  assert.equal(noAddress.status, 422)
  assert.ok((await noAddress.json()).fields.email)

  const invented = await post('/api/privacy', { type: 'send me money', email: 'ade@example.com' })
  assert.equal(invented.status, 422, 'and a right this service does not recognise is not recorded as one')

  // Three refusals above have spent the intake's budget of three; a malformed
  // body has to be able to reach the parser to be called malformed.
  resetLimits()
  const malformed = await fetch(`${base}/api/privacy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  })
  assert.equal(malformed.status, 400)
  await malformed.text()
})

test('the intake has the same bot trap as the enquiry form', async () => {
  resetLimits()
  const before = lines('privacy-requests.jsonl').length
  const res = await post('/api/privacy', { type: 'access', email: 'bot@example.com', company: 'Spam Ltd' })
  assert.equal(res.status, 201, 'a bot is told it succeeded')
  await res.json()
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(lines('privacy-requests.jsonl').length, before, 'and nothing is stored, so nobody has to delete it')
})

test('the intake is rate limited, and says where to go instead', async () => {
  resetLimits()
  const statuses = []
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await post('/api/privacy', { type: 'correction', email: `patient${attempt}@example.com` })
    statuses.push(res.status)
    await res.text()
  }
  assert.equal(statuses.filter((status) => status === 429).length >= 1, true, `the budget runs out (${statuses.join(',')})`)
  const body = await (await post('/api/privacy', { type: 'correction', email: 'patient@example.com' })).json()
  assert.match(body.error, /hello@opudapaint\.com/, 'a person who is being throttled is given the human route')
})

/* ------------------------------------------------------ the text itself */

test('the acknowledgement text survives a record with nothing in it', () => {
  const text = acknowledgementText({ reference: 'OPD-261103-0000', name: '' }, null)
  assert.match(text, /Hello there/, 'an unnamed visitor is still greeted')
  assert.match(text, /OPD-261103-0000/)
  assert.match(text, /colour desk/, 'and a record with no routing still says who will answer')
  assert.doesNotMatch(text, /undefined|null|NaN/, 'no placeholder reaches the customer')
})

test('a long message is quoted, not dumped', () => {
  const text = acknowledgementText(
    { reference: 'OPD-261103-0001', name: 'Ada', projectType: 'interior', message: 'x'.repeat(5000) },
    { routedTo: 'Colour desk', slaHours: 24 },
  )
  assert.ok(text.length < 1600, `the acknowledgement stays a readable length (${text.length} characters)`)
  assert.match(text, /…/, 'and an elided message says it was elided')
})
