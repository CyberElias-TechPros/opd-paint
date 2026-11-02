/**
 * Enquiry service — deployment-edge tests. Run with `npm test`.
 *
 * `index.test.mjs` covers the HTTP contract from a developer's machine. This file
 * covers the things that only go wrong in a deployment:
 *
 *   • cross-origin calls, which a browser discards unless the service says so in
 *     headers (docs/deploying.md describes exactly that topology);
 *   • rate limiting behind a reverse proxy, where every visitor otherwise shares
 *     the gateway's address and the twelfth enquiry locks out a city;
 *   • the colour index, which used to be parsed out of TypeScript sources that
 *     the runtime container does not contain;
 *   • path traversal against the static root, including the sibling-directory
 *     case that a prefix check without a separator lets through;
 *   • CSV formula injection, because staff open the export in Excel;
 *   • newsletter opt-out, the promise the footer has always printed.
 *
 * Each of these is a regression that would not be visible in a browser test on
 * localhost, which is why they have their own file and their own environment.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

const dataDir = mkdtempSync(join(tmpdir(), 'opd-edge-data-'))
const staticDir = mkdtempSync(join(tmpdir(), 'opd-edge-site'))
/**
 * A sibling whose name *starts with* the static root's name.
 *
 * `resolve(...).startsWith(STATIC_DIR)` accepts this directory, because
 * `/tmp/opd-edge-siteAB12` begins with `/tmp/opd-edge-site`. The guard has to
 * compare against the root plus a path separator.
 */
const siblingDir = `${staticDir}-secret`

process.env.OPD_DATA_DIR = dataDir
process.env.OPD_STATIC_DIR = staticDir
process.env.OPD_ALLOWED_ORIGIN = 'https://www.opudapaint.com'
process.env.OPD_TRUST_PROXY = 'true'
process.env.OPD_ADMIN_USER = 'desk'
process.env.OPD_ADMIN_PASSWORD = 'correct horse battery'

// Imported after the environment is set: the module reads it once, at load time.
const { createEnquiryServer } = await import('./index.mjs')

let server
let base

before(async () => {
  mkdirSync(join(staticDir, 'colours'), { recursive: true })
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>OPUDA’S PAINT</title>')
  writeFileSync(join(staticDir, 'colours', 'index.html'), '<!doctype html><title>Colour library</title>')
  writeFileSync(join(staticDir, '404.html'), '<!doctype html><title>Not found</title>')
  mkdirSync(siblingDir, { recursive: true })
  writeFileSync(join(siblingDir, 'leak.txt'), 'this file must never be served')

  server = createEnquiryServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(staticDir, { recursive: true, force: true })
  rmSync(siblingDir, { recursive: true, force: true })
})

const SITE_ORIGIN = 'https://www.opudapaint.com'

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const enquiry = {
  name: 'Ade Balogun',
  phone: '0803 123 4567',
  city: 'Port Harcourt',
  projectType: 'interior',
  rooms: '4',
  message: 'Whole flat repaint, moving in on the 14th.',
  consent: true,
}

const quotes = () =>
  readFileSync(join(dataDir, 'quotes.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))

const unsubs = () =>
  readFileSync(join(dataDir, 'unsubscriptions.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))

/* -------------------------------------------------------------------- CORS */

test('a cross-origin preflight is answered with the headers a browser needs', async () => {
  const res = await fetch(`${base}/api/quotes`, {
    method: 'OPTIONS',
    headers: { Origin: SITE_ORIGIN, 'Access-Control-Request-Method': 'POST' },
  })
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('access-control-allow-origin'), SITE_ORIGIN)
  assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/)
  assert.match(res.headers.get('access-control-allow-headers') ?? '', /Content-Type/i)
  assert.match(res.headers.get('vary') ?? '', /Origin/)
})

test('an origin that is not allowed gets no cross-origin permission', async () => {
  const res = await fetch(`${base}/api/health`, { headers: { Origin: 'https://someone-elses-site.example' } })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('access-control-allow-origin'), null)
})

test('a rejected submission still carries CORS headers', async () => {
  // Without this the browser reports a network error and the form cannot show
  // which field was wrong — the most common way a cross-origin form "breaks".
  const res = await post('/api/quotes', { ...enquiry, name: '' }, { Origin: SITE_ORIGIN })
  assert.equal(res.status, 422)
  assert.equal(res.headers.get('access-control-allow-origin'), SITE_ORIGIN)
  const body = await res.json()
  assert.ok(body.fields.name)
})

test('the admin inbox does not advertise itself to cross-origin callers', async () => {
  const res = await fetch(`${base}/admin`, { method: 'OPTIONS', headers: { Origin: SITE_ORIGIN } })
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('access-control-allow-origin'), null)
})

/* ------------------------------------------------------- proxy + rate limit */

test('rate limits follow the visitor rather than the proxy they arrive through', async () => {
  const from = (ip) => post('/api/quotes', { ...enquiry, name: 'x' }, { 'X-Forwarded-For': ip })

  for (let i = 0; i < 12; i += 1) await from('203.0.113.7')
  const limited = await from('203.0.113.7')
  assert.equal(limited.status, 429, 'the thirteenth request from one visitor is refused')

  const neighbour = await from('203.0.113.99')
  assert.notEqual(neighbour.status, 429, 'a different visitor behind the same proxy is unaffected')
})

test('a spoofed X-Forwarded-For prefix cannot rotate the rate limit', async () => {
  // nginx's usual `$proxy_add_x_forwarded_for` appends the real address to
  // whatever the client sent, so the left-hand entries are visitor-controlled.
  // Counting trusted hops from the right makes inventing them useless.
  const send = (xff) => post('/api/quotes', { ...enquiry, name: 'x' }, { 'X-Forwarded-For': xff })
  for (let i = 0; i < 12; i += 1) await send(`10.0.0.${i}, 198.51.100.77`)
  const limited = await send('10.0.0.200, 198.51.100.77')
  assert.equal(limited.status, 429, 'the rightmost hop is the visitor; a new left-hand entry changes nothing')
})

test('the forwarded address is recorded for abuse review, not the gateway', async () => {
  await post('/api/errors', { message: 'boom', kind: 'error' }, { 'X-Forwarded-For': '198.51.100.4' })
  const lines = readFileSync(join(dataDir, 'errors.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
  assert.ok(
    lines.some((entry) => JSON.stringify(entry).includes('198.51.100.4')),
    'the visitor address appears in the error record',
  )
})

/* ------------------------------------------------------------ colour index */

test('colour search answers from the generated index, with the fields the client expects', async () => {
  const res = await fetch(`${base}/api/search/colours?q=OP-001`)
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.index, 'generated', 'the built index is used, not a parse of the TypeScript sources')
  assert.equal(body.results.length, 1)
  const [hit] = body.results
  assert.equal(hit.id, 'opuda-white')
  assert.match(hit.hex, /^#[0-9A-F]{6}$/i, 'the hex is present: the client renders a swatch from it')
  assert.ok(hit.family, 'the family is present: the client groups results by it')
})

test('colour search finds a colour by family and by partial name', async () => {
  const byFamily = await (await fetch(`${base}/api/search/colours?q=green`)).json()
  assert.ok(byFamily.results.length > 1, 'a family name matches the family, not just colour names')
  const byName = await (await fetch(`${base}/api/search/colours?q=harmattan`)).json()
  assert.ok(byName.results.some((colour) => /harmattan/i.test(colour.name)))
})

/* --------------------------------------------------------- static traversal */

test('the static root serves prerendered routes', async () => {
  const res = await fetch(`${base}/colours`)
  assert.equal(res.status, 200)
  assert.match(await res.text(), /Colour library/)
})

test('an encoded traversal cannot reach a sibling of the static root', async () => {
  // %2e%2e%2f is decoded by the handler, so this is the real vector: a plain
  // `../` would be normalised away by the URL parser before it arrived.
  const escaped = `%2e%2e%2f${basename(siblingDir)}%2fleak.txt`
  const res = await fetch(`${base}/${escaped}`)
  const text = await res.text()
  assert.notEqual(res.status, 200)
  assert.ok(!text.includes('must never be served'), 'the sibling file was not served')
})

test('an unknown path answers 404 with the branded document', async () => {
  const res = await fetch(`${base}/no-such-page`)
  assert.equal(res.status, 404)
  assert.match(await res.text(), /Not found/)
})

/* ------------------------------------------------- quantities and routing */

test('measured quantities are stored with the enquiry', async () => {
  const res = await post('/api/quotes', {
    ...enquiry,
    projectType: 'exterior',
    quantities: [
      { label: 'Lounge — 2 × 20 L', amount: 34.2, unit: 'L' },
      { label: 'Ceiling — 1 × 4 L', amount: 4, unit: 'L' },
    ],
  })
  assert.equal(res.status, 201)
  const record = quotes().at(-1)
  assert.equal(record.quantities.length, 2)
  assert.equal(record.quantities[0].amount, 34.2)
  assert.equal(record.quantities[0].label, 'Lounge — 2 × 20 L')
})

test('a quantity that is not a positive number is dropped rather than stored', async () => {
  await post('/api/quotes', {
    ...enquiry,
    quantities: [
      { label: 'junk', amount: 'lots', unit: 'L' },
      { label: 'negative', amount: -5, unit: 'L' },
      { label: 'real', amount: 12, unit: 'buckets' },
    ],
  })
  const record = quotes().at(-1)
  assert.equal(record.quantities.length, 1)
  assert.equal(record.quantities[0].label, 'real')
  assert.equal(record.quantities[0].unit, 'L', 'an unknown unit falls back to litres')
})

test('the desk an enquiry was routed to is stored, not only returned', async () => {
  // The inbox and the CSV both report this column; until it was persisted every
  // record read "Unrouted" and the desk split on /admin was permanently empty.
  await post('/api/quotes', { ...enquiry, projectType: 'exterior' })
  const exterior = quotes().at(-1)
  assert.equal(exterior.routedTo, 'Technical desk — exterior specification')
  assert.equal(exterior.slaHours, 24)

  await post('/api/quotes', { ...enquiry, projectType: 'dealer' })
  const dealer = quotes().at(-1)
  assert.equal(dealer.routedTo, 'Commercial team — dealer enquiries')
  assert.equal(dealer.slaHours, 48, 'a dealer enquiry gets the longer commitment the site states')
})

/* ------------------------------------------------------------- CSV export */

test('the CSV export neutralises a formula submitted in an enquiry', async () => {
  await post('/api/quotes', {
    ...enquiry,
    message: "=cmd|'/C calc'!A1",
  })
  const res = await fetch(`${base}/admin/enquiries.csv`, {
    headers: { Authorization: `Basic ${Buffer.from('desk:correct horse battery').toString('base64')}` },
  })
  assert.equal(res.status, 200)
  const csv = await res.text()
  assert.match(csv.split('\n')[0], /quantities/, 'the header carries the columns the desk needs')
  assert.match(csv.split('\n')[0], /routedTo/)
  const row = csv.split('\n').find((line) => line.includes('calc'))
  assert.ok(row, 'the submission is in the export')
  assert.match(row, /"'=cmd\|/, 'the cell is quoted and prefixed, so Excel reads it as text')
  assert.ok(!/"=cmd/.test(row), 'no cell begins with a bare =')
})

test('the CSV export quotes an embedded quote and a newline', async () => {
  await post('/api/quotes', { ...enquiry, rooms: '4 beds, "the big one"\nlots of light' })
  const res = await fetch(`${base}/admin/enquiries.csv`, {
    headers: { Authorization: `Basic ${Buffer.from('desk:correct horse battery').toString('base64')}` },
  })
  const csv = await res.text()
  assert.match(csv, /""the big one""/, 'a quote inside a cell is doubled')
  assert.equal(csv.split('\n').filter((line) => line.startsWith('"')).length >= 1, true)
})

/* ------------------------------------------------------- newsletter opt-out */

test('an address can be removed, and the removal is recorded', async () => {
  const res = await post('/api/unsubscribe', { email: 'ade@example.com', source: 'footer' })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.ok, true)
  const record = unsubs().at(-1)
  assert.equal(record.email, 'ade@example.com')
  assert.equal(record.source, 'footer')
  assert.ok(record.at, 'the opt-out is timestamped: consent withdrawal has to be provable')
})

test('an unsubscribe with no valid address is refused', async () => {
  const res = await post('/api/unsubscribe', { email: 'not-an-address' })
  assert.equal(res.status, 422)
})

test('re-subscribing after an opt-out is recorded as fresh consent', async () => {
  const res = await post('/api/subscribe', { email: 'ade@example.com', interest: 'colour-notes' })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.resubscribed, true, 'the response says this address had opted out')

  const subscriptions = readFileSync(join(dataDir, 'subscriptions.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
  assert.equal(subscriptions.at(-1).resubscribed, true)
  assert.equal(unsubs().at(-1).retired, 'resubscribed', 'the suppression entry is retired, not deleted')
})

test('a second opt-out suppresses the address again', async () => {
  await post('/api/unsubscribe', { email: 'ade@example.com' })
  const res = await post('/api/subscribe', { email: 'ade@example.com', interest: 'colour-notes' })
  const body = await res.json()
  // The address opted out again after the retirement, so this is a fresh opt-in
  // to a suppressed address: recorded, and flagged as a re-subscription.
  assert.equal(body.data.resubscribed, true)
})

test('the suppression list is matched without regard to case', async () => {
  await post('/api/unsubscribe', { email: 'Case@Example.COM' })
  const res = await post('/api/subscribe', { email: 'case@example.com', interest: 'colour-notes' })
  const body = await res.json()
  assert.equal(body.data.resubscribed, true, 'the same mailbox is recognised however it was typed')
})
