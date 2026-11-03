/**
 * The enquiry inbox: who gets in, what they can do, and what is written down.
 *
 * Run with `npm test`.
 *
 * Roadmap 17.02.12 asks for a named owner with enforced access control, MFA and
 * an access log. The inbox had one shared password, no second factor, no roles,
 * no record of who looked and no network restriction. These tests pin what
 * replaced it.
 *
 * Two things worth knowing before reading them:
 *
 *   • Every decision — allowed, denied, challenged — is appended to
 *     `admin-access.jsonl`. Several assertions read that file, because access
 *     control that leaves no trace cannot be audited, which is the point of it.
 *   • The tests are ordered, and the order matters twice over. A failed second
 *     factor costs an attempt against a six-per-ten-minute budget keyed on the
 *     address, and every request here comes from 127.0.0.1, so the brute-force
 *     test runs last. And a TOTP code is single use within its 30-second step:
 *     two tests that both unlocked as the same account inside the same step would
 *     have the second one refused as a replay. So each test that needs to get in
 *     gets in as a different member of staff — which is also how the deployment
 *     is meant to look, one named person per account.
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = mkdtempSync(join(tmpdir(), 'opd-admin-'))

/** One account per test that needs to unlock the inbox. See the note above. */
const STAFF = {
  ada: { password: 'correct horse battery', role: 'exporter', secret: 'JBSWY3DPEHPK3PXP' },
  funmi: { password: 'steady hand steady eye', role: 'exporter', secret: 'GEZDGNBVGY3TQOJQ' },
  tola: { password: 'measure twice cut once', role: 'exporter', secret: 'MFRGGZLTMY2TQNLJ' },
  chidi: { password: 'primer before colour', role: 'exporter', secret: 'ORSXG5BAONUWO43T' },
  bola: { password: 'two coats never one', role: 'exporter', secret: 'ORSXG5DBMFRGGZLT' },
  grace: { password: 'viewer pass phrase', role: 'viewer', secret: null },
}

process.env.OPD_DATA_DIR = dataDir
process.env.OPD_LOG_LEVEL = 'error'
process.env.OPD_LOG_FORMAT = 'json'
process.env.OPD_SESSION_SECRET = 'a session secret long enough to be one'
process.env.OPD_ADMIN_USERS = JSON.stringify(
  Object.entries(STAFF).map(([user, account]) => ({
    user,
    password: account.password,
    role: account.role,
    ...(account.secret ? { totp: account.secret } : {}),
  })),
)

const { createEnquiryServer } = await import('./index.mjs')
const {
  authenticate,
  base32Encode,
  createChallenge,
  createSession,
  hotp,
  ipAllowed,
  newSecret,
  provisioningUri,
  readToken,
  sameSecret,
  totp,
  verifyTotp,
} = await import('./auth.mjs')

const server = createEnquiryServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
})

const accessLog = () =>
  readFileSync(join(dataDir, 'admin-access.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))

const lastDecision = () => accessLog().at(-1)

const basic = (user) => `Basic ${Buffer.from(`${user}:${STAFF[user].password}`).toString('base64')}`

/**
 * Fetch without following the redirect, and keep the cookies.
 *
 * A successful unlock and a sign-out are both `303`s that set or clear a cookie;
 * a client that followed the redirect quietly would show neither.
 */
const send = (path, { headers = {}, method = 'GET', body } = {}) =>
  fetch(`${base}${path}`, { method, headers, body, redirect: 'manual' })

const cookieNamed = (res, name) => res.headers.getSetCookie().find((line) => line.startsWith(`${name}=`))

/** Ask for the inbox as `user`, and return the challenge cookie it hands back. */
const challengeFor = async (user, path = '/admin') => {
  const res = await send(path, { headers: { Authorization: basic(user) } })
  const cookie = cookieNamed(res, 'opd_mfa')
  await res.text()
  return { res, cookie }
}

/** Post the unlock form the way the browser does: urlencoded, with the challenge cookie. */
const unlock = (cookie, code) =>
  send('/admin/second-factor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ code }).toString(),
  })

/** The whole flow: credentials, code, session cookie. */
const signIn = async (user, path = '/admin') => {
  const { cookie } = await challengeFor(user, path)
  const res = await unlock(cookie, totp(STAFF[user].secret))
  const session = cookieNamed(res, 'opd_admin')
  await res.text()
  return { res, session }
}

/* --------------------------------------------------------------- the codes */

test('the codes are RFC 4226 / 6238, not an invention of this file', () => {
  // Every published vector for the secret "12345678901234567890", in the base32
  // an authenticator app would be given. An implementation that passes these
  // interoperates with every app; one that does not will lock its own owner out
  // of their own inbox.
  const secret = base32Encode(Buffer.from('12345678901234567890', 'ascii'))
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  const vectors = [
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [4, '338314'],
    [5, '254676'],
    [6, '287922'],
    [7, '162583'],
    [8, '399871'],
    [9, '520489'],
  ]
  for (const [counter, code] of vectors) {
    assert.equal(hotp(secret, counter), code, `HOTP vector ${counter}`)
  }
  // RFC 6238 publishes eight digits; this service asks for six, which is the
  // last six of the same number.
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '94287082'.slice(-6))
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1_111_111_109_000), '07081804'.slice(-6))
  assert.equal(newSecret().length, 32, 'a generated secret is 20 bytes of entropy, base32 encoded')
  assert.notEqual(newSecret(), newSecret(), 'and two of them are not the same secret')
})

test('enrolment prints something an authenticator app can scan', () => {
  const secret = newSecret()
  const uri = provisioningUri(secret, 'ada')
  assert.match(uri, /^otpauth:\/\/totp\//)
  assert.match(uri, /secret=/, 'the secret is in the URI, which is the only place it is ever shown')
  assert.match(uri, /issuer=/, 'and the app labels it with who it belongs to')
  assert.match(uri, /ada/, 'labelled with the account, so two inboxes in one app are tellable apart')
})

test('credentials are compared without giving away where they differ', () => {
  assert.equal(sameSecret('correct horse battery', 'correct horse battery'), true)
  assert.equal(sameSecret('correct horse battery', 'correct horse batterY'), false)
  assert.equal(sameSecret('', ''), false, 'two empty secrets are not a match — an unset password is not a password')
  assert.equal(sameSecret('anything', ''), false)
})

test('the authorization header is parsed, or it is not credentials', () => {
  const header = (value) => 'Basic ' + Buffer.from(value).toString('base64')
  assert.equal(authenticate(header('ada:correct horse battery'))?.name, 'ada')
  assert.equal(authenticate(header('ada:correct horse battery'))?.role, 'exporter')
  assert.equal(authenticate(header('grace:viewer pass phrase'))?.role, 'viewer')
  assert.equal(authenticate(header('ada:nope')), null)
  assert.equal(authenticate(header('nobody:whatever')), null, 'an account that does not exist is not one')
  assert.equal(authenticate(header('ada')), null, 'a header with no colon is not credentials')
  assert.equal(authenticate('Bearer abc123'), null, 'and neither is a scheme this service does not speak')
  assert.equal(authenticate(undefined), null)
  assert.equal(authenticate('Basic not-base64-at-all!!'), null, 'a header that will not decode is refused, not thrown on')
})

test('a session token and an unlock token are not the same kind of thing', () => {
  const session = createSession({ name: 'ada', role: 'exporter' })
  const challenge = createChallenge({ name: 'ada', role: 'exporter' })

  assert.equal(readToken(session, { kind: 'session' })?.name, 'ada')
  assert.equal(readToken(challenge, { kind: 'challenge' })?.name, 'ada')
  // The one that matters: an unlock token is issued before the code is checked,
  // so if it could be presented as a session it would be a way in.
  assert.equal(readToken(challenge, { kind: 'session' }), null, 'a challenge is not a session')
  assert.equal(readToken(session, { kind: 'challenge' }), null, 'and a session is not a challenge')
  assert.equal(readToken(session.slice(0, -4) + 'AAAA', { kind: 'session' }), null, 'an edited signature is nothing')
  assert.equal(readToken('nonsense', { kind: 'session' }), null)
  assert.equal(readToken('', { kind: 'session' }), null)

  const expired = createSession({ name: 'ada', role: 'exporter' }, -10)
  assert.equal(readToken(expired, { kind: 'session' }), null, 'and a token past its expiry is nothing')
})

test('an allowlist understands ranges, single addresses and rubbish', () => {
  const configured = process.env.OPD_ADMIN_ALLOW_CIDR
  try {
    process.env.OPD_ADMIN_ALLOW_CIDR = '10.0.0.0/8, 192.168.1.5, 2001:db8::/32'
    assert.equal(ipAllowed('10.1.2.3'), true, 'a range')
    assert.equal(ipAllowed('192.168.1.5'), true, 'one address on its own')
    assert.equal(ipAllowed('192.168.1.6'), false)
    assert.equal(ipAllowed('2001:db8::1'), true, 'IPv6 is a thing a deployment might be on')
    assert.equal(ipAllowed('2001:db8:0:1::9'), true, 'anywhere inside the /32, not just the first address')
    assert.equal(ipAllowed('2001:db9::1'), false, 'and a neighbouring block is outside it')
    assert.equal(ipAllowed('127.0.0.1'), false, 'and an address nobody listed is not allowed')

    process.env.OPD_ADMIN_ALLOW_CIDR = '2001:db8::5'
    assert.equal(ipAllowed('2001:db8::5'), true, 'a single IPv6 address with no prefix means exactly that address')
    assert.equal(ipAllowed('2001:0db8:0000:0000:0000:0000:0000:0005'), true, 'written out in full is the same address')
    assert.equal(ipAllowed('2001:db8::6'), false)
    assert.equal(ipAllowed('02001:db8::5'), false, 'and a group of five digits is not an address')

    process.env.OPD_ADMIN_ALLOW_CIDR = '10.0.0.0/8'
    assert.equal(ipAllowed('::ffff:10.1.2.3'), true, 'an IPv4-mapped address is the IPv4 address it maps')
    assert.equal(ipAllowed('2001:db8::1'), false, 'and the other family never matches across')

    process.env.OPD_ADMIN_ALLOW_CIDR = 'not-a-network, 10.0.0.0/99, 2001:db8::/129, ::::/64'
    assert.equal(ipAllowed('10.1.2.3'), false, 'an entry that cannot be parsed allows nothing')
    assert.equal(ipAllowed('2001:db8::1'), false)
    assert.equal(ipAllowed('127.0.0.1'), false)

    delete process.env.OPD_ADMIN_ALLOW_CIDR
    assert.equal(ipAllowed('203.0.113.9'), true, 'with no allowlist configured, the credentials are the only gate')
  } finally {
    if (configured === undefined) delete process.env.OPD_ADMIN_ALLOW_CIDR
    else process.env.OPD_ADMIN_ALLOW_CIDR = configured
  }
})

test('a code is single use, tolerant of a drifting clock, and nothing else', () => {
  // A fixed timestamp from 2023: these counters cannot collide with the ones the
  // HTTP tests below spend against the real clock.
  const at = 1_700_000_000_000
  const secret = STAFF.ada.secret
  const code = totp(secret, at)

  assert.equal(verifyTotp(secret, code, { atMs: at, account: 'rfc' }).ok, true)
  assert.equal(verifyTotp(secret, code, { atMs: at, account: 'rfc' }).ok, false, 'the same code cannot be spent twice')
  assert.equal(
    verifyTotp(secret, code, { atMs: at, account: 'rfc-other' }).ok,
    true,
    'single use is per account: two people can legitimately type the same number in the same half minute',
  )

  // A phone clock a step ahead or behind is normal, and locking somebody out over
  // it is the most common way an MFA rollout fails. Two minutes out is not.
  assert.equal(verifyTotp(secret, totp(secret, at), { atMs: at + 30_000, account: 'skew-1' }).ok, true, 'one step late')
  assert.equal(verifyTotp(secret, totp(secret, at), { atMs: at - 30_000, account: 'skew-2' }).ok, true, 'one step early')
  assert.equal(verifyTotp(secret, totp(secret, at), { atMs: at + 120_000, account: 'skew-3' }).ok, false, 'four steps late')

  assert.equal(verifyTotp(secret, 'abcdef', { atMs: at, account: 'bad-1' }).reason, 'malformed')
  assert.equal(verifyTotp(secret, '12345', { atMs: at, account: 'bad-2' }).reason, 'malformed', 'five digits is not a code')
  assert.equal(verifyTotp(secret, '', { atMs: at, account: 'bad-3' }).ok, false)
  assert.equal(verifyTotp('', code, { atMs: at, account: 'bad-4' }).reason, 'no-secret', 'an account with no secret has no codes')
  assert.equal(verifyTotp(secret, ' 123456 ', { atMs: at, account: 'bad-5' }).ok === false || code === '123456', true, 'padded input is not a free pass')
})

/* ------------------------------------------------------------ getting in */

test('a wrong password is refused, and the attempt is written down', async () => {
  const res = await send('/admin', { headers: { Authorization: 'Basic ' + Buffer.from('ada:wrong horse battery').toString('base64') } })
  // 401, not 404: this is the response that makes a browser show its password
  // prompt, and the inbox is reached by typing a URL into an address bar. Without
  // the prompt there is no way to sign in at all. When the inbox is *not*
  // configured the answer is 404, which is the case `index.test.mjs` covers.
  assert.equal(res.status, 401)
  assert.match(res.headers.get('www-authenticate') ?? '', /Basic realm=/)
  await res.text()
  const entry = lastDecision()
  assert.equal(entry.decision, 'denied-credentials')
  assert.equal(entry.path, '/admin')
  assert.ok(!('user' in entry), 'an attempt that proved nothing is not attributed to anybody')
})

test('an unknown account is refused the same way as a wrong password', async () => {
  const res = await send('/admin', {
    headers: { Authorization: 'Basic ' + Buffer.from('nobody:whatever they typed').toString('base64') },
  })
  // Identical status, identical header, identical body: which of the two it was
  // is knowable from the access log, and from nowhere else.
  assert.equal(res.status, 401)
  assert.match(res.headers.get('www-authenticate') ?? '', /Basic realm=/)
  await res.text()
  assert.equal(lastDecision().decision, 'denied-credentials')
})

test('correct credentials are not enough: the second factor is asked for', async () => {
  const res = await send('/admin', { headers: { Authorization: basic('ada') } })
  assert.equal(res.status, 200)
  const page = await res.text()
  assert.match(page, /authenticator app/i, 'the page says what to type')
  assert.match(page, /ada/, 'and who it thinks is signing in')
  assert.doesNotMatch(page, /correct horse battery/, 'the password is never echoed back')
  assert.doesNotMatch(page, /JBSWY3DPEHPK3PXP/i, 'and neither is the shared secret')

  const cookie = cookieNamed(res, 'opd_mfa')
  assert.ok(cookie, 'a short-lived challenge cookie is set')
  assert.match(cookie, /HttpOnly/, 'page script cannot read it')
  assert.match(cookie, /SameSite=Strict/, 'and a cross-site form cannot post it')
  assert.match(cookie, /Max-Age=300/, 'it lives five minutes, not as long as the browser')

  assert.equal(lastDecision().decision, 'challenge-mfa')
  assert.equal(lastDecision().user, 'ada', 'the challenge is attributed, so a pattern of them is visible')
})

test('the code unlocks the inbox, and the session outlives the credentials', async () => {
  const { res, session } = await signIn('ada')
  assert.equal(res.status, 303, 'a successful form post redirects back to the inbox')
  assert.ok(session, 'a signed session cookie is issued')
  assert.match(session, /HttpOnly/)
  assert.match(session, /SameSite=Strict/)
  assert.match(session, /Max-Age=3600/, 'an hour by default, and configurable between a minute and a day')
  assert.match(cookieNamed(res, 'opd_mfa') ?? '', /Max-Age=0/, 'the challenge is cleared once it has been spent')
  assert.equal(lastDecision().decision, 'allowed-mfa')

  // The point of the session: a browser does not resend Basic credentials on
  // every navigation, so this request carries the cookie and nothing else.
  const inbox = await send('/admin', { headers: { Cookie: session.split(';')[0] } })
  assert.equal(inbox.status, 200, 'the session alone is enough to reach the inbox')
  const page = await inbox.text()
  assert.match(page, /Signed in as <strong>ada<\/strong> · exporter role/, 'and the page says who is looking, and as what')
  assert.match(page, /enquiries\.csv/, 'an exporter is offered the download')
  assert.match(page, /Sign out/, 'and a way out')
  assert.equal(inbox.headers.get('x-frame-options'), 'DENY', 'the inbox cannot be framed')
  assert.match(inbox.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/, 'and the policy says so too')
  assert.match(inbox.headers.get('content-security-policy') ?? '', /form-action 'self'/, 'the sign-out form posts here and nowhere else')
  assert.equal(inbox.headers.get('cache-control'), 'no-store', 'a page of customer data is never cached')
  assert.equal(lastDecision().decision, 'allowed')
  assert.equal(lastDecision().via, 'session', 'the log records how the identity was proved')
})

test('a spent code cannot be replayed', async () => {
  const { cookie } = await challengeFor('funmi')
  const code = totp(STAFF.funmi.secret)

  const first = await unlock(cookie, code)
  assert.equal(first.status, 303)
  await first.text()

  const replay = await unlock(cookie, code)
  assert.equal(replay.status, 401, 'the same code a second time is a refusal, not a page that looks fine')
  const page = await replay.text()
  assert.match(page, /already been used/, 'and it says why, because the usual cause is a clock or a copy-paste')
  const entry = lastDecision()
  assert.equal(entry.decision, 'denied-mfa')
  assert.equal(entry.reason, 'replayed')
})

test('a wrong code is refused, and the refusal is counted', async () => {
  const { cookie } = await challengeFor('tola')
  const wrong = String((Number(totp(STAFF.tola.secret)) + 1) % 1_000_000).padStart(6, '0')

  const res = await unlock(cookie, wrong)
  assert.equal(res.status, 401)
  const page = await res.text()
  assert.match(page, /did not match/, 'the page explains itself instead of failing silently')
  assert.equal(lastDecision().decision, 'denied-mfa')
  assert.equal(lastDecision().reason, 'wrong')
})

test('an unlock page that expired is not an unlock page', async () => {
  // No challenge cookie at all: somebody posted the form after five minutes, or
  // from somewhere that never had one.
  const res = await send('/admin/second-factor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: '123456' }).toString(),
  })
  assert.equal(res.status, 401)
  assert.match(await res.text(), /expired/i)
  assert.equal(lastDecision().decision, 'denied-challenge')
})

test('a session cookie that has been edited is not a session', async () => {
  const { session } = await signIn('chidi')
  const [value] = session.split(';')[0].slice('opd_admin='.length).split('.')
  const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  assert.equal(payload.u, 'chidi')
  assert.equal(payload.k, 'session', 'the token says what kind of token it is')

  payload.role = 'exporter'
  payload.exp = Math.floor(Date.now() / 1000) + 86_400
  const forged = `${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.not-a-real-signature`

  const res = await send('/admin', { headers: { Cookie: `opd_admin=${forged}` } })
  assert.equal(res.status, 401, 'a tampered token is refused, and the request is left with no identity at all')
  await res.text()
  assert.equal(lastDecision().decision, 'denied-credentials')
})

/* ------------------------------------------------------- roles and reach */

test('a viewer can read the inbox and cannot export it', async () => {
  const res = await send('/admin', { headers: { Authorization: basic('grace') } })
  assert.equal(res.status, 200, 'no second factor is configured for this account, so credentials are enough')
  const page = await res.text()
  assert.match(page, /Signed in as <strong>grace<\/strong> · viewer role/)
  assert.match(page, /can read this page but not export it/, 'the missing button is explained, not just absent')
  assert.doesNotMatch(page, /href="\/admin\/enquiries\.csv"/, 'and it is genuinely not offered')
  assert.equal(lastDecision().decision, 'allowed')
  assert.equal(lastDecision().role, 'viewer')

  const csv = await send('/admin/enquiries.csv', { headers: { Authorization: basic('grace') } })
  assert.equal(csv.status, 403)
  assert.match(await csv.text(), /exporter role/, 'the refusal says which role is needed')
  const entry = lastDecision()
  assert.equal(entry.decision, 'denied-role')
  assert.equal(entry.path, '/admin/enquiries.csv')
  assert.equal(entry.user, 'grace')
})

test('an exporter gets the CSV, second factor and all', async () => {
  // The challenge cannot be rendered on a download: a CSV response has nowhere to
  // put a form. So the route refuses with a 401 that says where to go, and the
  // session picked up at /admin is what carries the download.
  const direct = await send('/admin/enquiries.csv', { headers: { Authorization: basic('bola') } })
  assert.equal(direct.status, 401)
  assert.match(await direct.text(), /Open \/admin in a browser/, 'the refusal tells the reader how to get in')
  assert.equal(lastDecision().decision, 'challenge-mfa')

  const { session } = await signIn('bola')
  const csv = await send('/admin/enquiries.csv', { headers: { Cookie: session.split(';')[0] } })
  assert.equal(csv.status, 200)
  assert.match(csv.headers.get('content-type'), /text\/csv/)
  assert.match(csv.headers.get('content-disposition') ?? '', /attachment/, 'a download, not something a browser renders')
  const body = await csv.text()
  assert.match(body, /^reference,/, 'the header row survived')
  assert.equal(lastDecision().decision, 'allowed')
})

test('a network outside the allowlist cannot reach the inbox at all', async () => {
  process.env.OPD_ADMIN_ALLOW_CIDR = '10.0.0.0/8, 2001:db8::/32'
  try {
    const res = await send('/admin', { headers: { Authorization: basic('ada') } })
    assert.equal(res.status, 404, 'the right credentials from the wrong network are still nothing')
    await res.text()
    const entry = lastDecision()
    assert.equal(entry.decision, 'denied-allowlist')
    assert.ok(!('user' in entry), 'and the attempt is not attributed to an account it never reached')
  } finally {
    process.env.OPD_ADMIN_ALLOW_CIDR = '127.0.0.0/8'
  }

  const allowed = await send('/admin', { headers: { Authorization: basic('grace') } })
  assert.equal(allowed.status, 200, 'an address inside an allowed range is judged on its credentials')
  await allowed.text()
  delete process.env.OPD_ADMIN_ALLOW_CIDR
})

test('an unrecognised path under /admin is a 404 like any other missing route', async () => {
  const res = await send('/admin/enquiries.json', { headers: { Authorization: basic('grace') } })
  assert.equal(res.status, 404)
  await res.text()
})

/* --------------------------------------------------------------- the log */

test('the access log names accounts and decisions, and leaks nothing else', () => {
  const raw = readFileSync(join(dataDir, 'admin-access.jsonl'), 'utf8')
  const entries = accessLog()

  assert.ok(entries.length > 12, `every decision is recorded (${entries.length} so far)`)
  for (const entry of entries) {
    assert.equal(typeof entry.at, 'string', 'each entry is timestamped')
    assert.equal(typeof entry.decision, 'string', 'and carries a decision')
    assert.equal(typeof entry.path, 'string')
    assert.equal(typeof entry.ip, 'string')
  }
  for (const decision of ['denied-credentials', 'challenge-mfa', 'allowed-mfa', 'denied-mfa', 'allowed', 'denied-role', 'denied-allowlist']) {
    assert.ok(entries.some((entry) => entry.decision === decision), `${decision} is in the log`)
  }

  assert.doesNotMatch(raw, /correct horse battery/, 'the password is never written down')
  assert.doesNotMatch(raw, /viewer pass phrase/)
  assert.doesNotMatch(raw, /JBSWY3DPEHPK3PXP/i, 'and neither is a TOTP secret')
  assert.doesNotMatch(raw, /opd_admin=[A-Za-z0-9_-]{10}/, 'nor a session token')
  assert.match(raw, /"user":"ada"/, 'who got in is attributable')
})

test('health reports the controls as capability, never as configuration', async () => {
  const res = await fetch(`${base}/api/health`)
  const body = await res.json()
  assert.equal(body.data.admin.mfa, true, 'at least one account has a second factor')
  assert.equal(typeof body.data.admin.allowlist, 'boolean')
  assert.equal(body.data.limits.store, 'file', 'limits here survive a restart')
  assert.equal(body.data.retention.operationalLogs, 30, 'the log period the privacy notice publishes')
  assert.equal(body.data.retention.enquiries, 730, 'and the 24 months it publishes for enquiries')
  const serialised = JSON.stringify(body)
  assert.doesNotMatch(serialised, /ada|grace|funmi/, 'and it does not list the accounts')
  assert.doesNotMatch(serialised, /OPD_/, 'nor the variable names that configure them')
})

test('signing out clears the cookie the browser is holding', async () => {
  const res = await send('/admin/sign-out', { method: 'POST', headers: { Authorization: basic('grace') } })
  assert.equal(res.status, 303)
  await res.text()
  const cleared = res.headers.getSetCookie()
  assert.ok(
    cleared.some((line) => line.startsWith('opd_admin=;') && line.includes('Max-Age=0')),
    'the session cookie is expired',
  )
  assert.ok(
    cleared.some((line) => line.startsWith('opd_mfa=;') && line.includes('Max-Age=0')),
    'and so is any half-finished challenge',
  )
  assert.equal(lastDecision().decision, 'signed-out')

  // Honest about the limit of a stateless session: a token copied out of the
  // browser before sign-out stays valid until it expires, because nothing on the
  // server holds a revocation list. That is the trade for a service with no
  // database; `OPD_ADMIN_SESSION_TTL` is how short you make the window.
  const after = await send('/admin')
  assert.equal(after.status, 401, 'with no cookie the browser is asked for credentials again')
  assert.match(after.headers.get('www-authenticate') ?? '', /Basic realm=/)
  await after.text()
})

/* --------------------------------------- the one test that spends the budget */

test('guessing codes is rate limited, and the refusals are logged', async () => {
  const { cookie } = await challengeFor('ada')

  const statuses = []
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const res = await unlock(cookie, String(100_000 + attempt))
    statuses.push(res.status)
    await res.text()
  }

  assert.ok(statuses.includes(429), `the budget runs out (got ${statuses.join(',')})`)
  assert.equal(statuses.at(-1), 429, 'and stays exhausted')

  const res = await unlock(cookie, totp(STAFF.ada.secret))
  assert.equal(res.status, 429, 'even a correct code is refused while the budget is spent — guessing must not be free')
  assert.match(await res.text(), /Too many attempts/)

  assert.ok(
    accessLog().filter((entry) => entry.decision === 'denied-rate').length >= 2,
    'the throttled attempts are in the access log',
  )
})
