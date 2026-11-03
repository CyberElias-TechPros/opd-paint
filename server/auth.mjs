/**
 * Who may open the enquiry inbox, and proof that they may.
 *
 * The inbox is the one part of this service that answers to a person rather than
 * a form, and it shows every customer's name, phone number and message. Roadmap
 * 17.01.04 (role-based access control), 17.01.12 (MFA on administrative
 * accounts), 17.01.13 (restrict production access and log privileged activity)
 * and 17.01.03 (secure session settings) all land here.
 *
 * Three layers, each independently optional, because a one-person business and a
 * hosted deployment do not have the same needs:
 *
 *  1. **Credentials.** `OPD_ADMIN_USER`/`OPD_ADMIN_PASSWORD` for one person, or
 *     `OPD_ADMIN_USERS` as JSON for several, each with a role. Compared in
 *     constant time, and every configured user is compared on every attempt so a
 *     wrong username and a wrong password cost the same.
 *  2. **A second factor.** RFC 6238 TOTP — the six digits from any authenticator
 *     app — implemented here with `node:crypto` because the alternative is a
 *     dependency for forty lines. Codes are checked across a one-step clock
 *     window and **each one is single-use**: a captured code cannot be replayed
 *     inside its own 30 seconds, which is the part most home-grown TOTP skips.
 *  3. **Where the request came from.** `OPD_ADMIN_ALLOW_CIDR` restricts the inbox
 *     to known networks. A request from anywhere else gets a 404, not a 403 —
 *     the same answer as "this service has no inbox", because the existence of
 *     an admin surface is not public information.
 *
 * After a successful second factor the browser gets a signed session cookie, so
 * the code is asked for once an hour rather than on every click. The cookie is
 * HMAC-SHA256 over `{user, role, expiry}`, `HttpOnly`, `SameSite=Strict` and
 * scoped to `Path=/admin`; nothing in it is trusted that was not signed here.
 *
 * Every decision — allowed, denied, and *why* — is appended to
 * `admin-access.jsonl`. It records the account name, the role, the address and
 * the path, and never a password, a code or an enquiry.
 *
 * Setup: `node server/auth.mjs --new-secret "Name (role)"` prints a base32
 * secret and an `otpauth://` URI to paste into an authenticator app or a QR
 * generator. It prints to stdout only, and nothing is written to disk.
 */
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { appendFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { log } from './logger.mjs'

export const ADMIN_ROLES = ['viewer', 'exporter']

/** How long a signed session lasts once the second factor is satisfied. */
export const SESSION_TTL_SECONDS = (() => {
  const configured = Number(process.env.OPD_ADMIN_SESSION_TTL)
  // A typo here would otherwise produce `Max-Age=NaN`, which browsers read as a
  // session cookie that outlives the shift — the opposite of what was meant.
  return Number.isFinite(configured) && configured >= 60 && configured <= 86_400 ? configured : 3600
})()

/** TOTP step and digits, per RFC 6238's SHA-1/30s/6-digit default. */
const TOTP_STEP_SECONDS = 30
const TOTP_DIGITS = 6
/** Accept one step either side, for a phone whose clock drifts. */
const TOTP_WINDOW = 1

/* ------------------------------------------------------------ credentials */

/**
 * The configured accounts.
 *
 * Read on every call rather than cached: the value comes from the environment,
 * which in a container is fixed for the life of the process, and re-reading
 * costs one `JSON.parse` on a request that is already doing file I/O.
 */
export function loadAdminUsers() {
  const raw = (process.env.OPD_ADMIN_USERS ?? '').trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('OPD_ADMIN_USERS must be a JSON array')
      const users = []
      for (const entry of parsed) {
        const user = String(entry?.user ?? '').trim()
        const password = String(entry?.password ?? '')
        const role = String(entry?.role ?? 'viewer')
        if (!user || !password) {
          log.warn('admin.user_incomplete', { detail: 'an entry in OPD_ADMIN_USERS has no user or no password' })
          continue
        }
        if (!ADMIN_ROLES.includes(role)) {
          log.warn('admin.role_unknown', { user, role, allowed: ADMIN_ROLES })
          continue
        }
        users.push({
          name: user,
          password,
          role,
          totp: normaliseSecret(String(entry?.totp ?? '')),
        })
      }
      return users
    } catch (error) {
      log.error('admin.users_unreadable', { message: String(error?.message ?? error) })
      return []
    }
  }

  const user = process.env.OPD_ADMIN_USER ?? ''
  const password = process.env.OPD_ADMIN_PASSWORD ?? ''
  if (!user || !password) return []
  const role = ADMIN_ROLES.includes(process.env.OPD_ADMIN_ROLE ?? '') ? process.env.OPD_ADMIN_ROLE : 'exporter'
  return [{ name: user, password, role, totp: normaliseSecret(process.env.OPD_ADMIN_TOTP_SECRET ?? '') }]
}

export function adminEnabled() {
  return loadAdminUsers().length > 0
}

/**
 * Look an account up by name.
 *
 * Used after the first factor has already succeeded, to fetch the second-factor
 * secret for the account the challenge names. Every account is compared, so the
 * time taken does not depend on where in the list the name sits.
 */
export function findAdminUser(name) {
  let found = null
  for (const account of loadAdminUsers()) {
    if (sameSecret(String(name ?? ''), account.name)) found = account
  }
  return found
}

/**
 * Constant-time equality that does not leak length by short-circuiting.
 *
 * Empty is never equal to empty. `loadAdminUsers` refuses to configure an
 * account with no password, so this cannot be reached that way — but a secret
 * that arrives empty from anywhere else (a variable that did not get set, a
 * `totp` that did not survive normalising) must fail closed rather than match
 * whatever empty thing was offered to it.
 */
export function sameSecret(candidate, expected) {
  const left = String(candidate ?? '')
  const right = String(expected ?? '')
  if (!left || !right) return false
  const a = createHash('sha256').update(left).digest()
  const b = createHash('sha256').update(right).digest()
  return timingSafeEqual(a, b)
}

/**
 * Check a Basic credential against every configured account.
 *
 * All of them, always: returning on the first match would make the response time
 * a function of where the account sits in the list, which is a way to enumerate
 * it.
 *
 * @returns {{ name: string, role: string, totp: string } | null}
 */
export function authenticate(headerValue) {
  const users = loadAdminUsers()
  if (!users.length) return null
  const [scheme, encoded] = String(headerValue ?? '').split(' ')
  if (scheme !== 'Basic' || !encoded) return null

  let decoded = ''
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8')
  } catch {
    return null
  }
  const separator = decoded.indexOf(':')
  if (separator === -1) return null
  const user = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)

  let matched = null
  for (const account of users) {
    const userOk = sameSecret(user, account.name)
    const passOk = sameSecret(password, account.password)
    if (userOk && passOk) matched = account
  }
  return matched
}

/* -------------------------------------------------------------------- TOTP */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Strip the spaces and dashes people copy out of a QR generator. */
export function normaliseSecret(secret) {
  return String(secret ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '')
}

/** RFC 4648 base32 → bytes. No padding required. */
export function base32Decode(secret) {
  const clean = normaliseSecret(secret)
  let bits = 0
  let value = 0
  const out = []
  for (const char of clean) {
    const index = BASE32.indexOf(char)
    if (index === -1) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

/**
 * The six digits for one counter value — the whole of RFC 6238 that matters.
 *
 * Exported because the alternative to testing it against the RFC's own test
 * vectors is trusting it, and a second factor you cannot test is a second factor
 * that locks everybody out at 3am.
 */
export function hotp(secret, counter, digits = TOTP_DIGITS) {
  const key = base32Decode(secret)
  if (!key.length) return ''
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', key).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(truncated % 10 ** digits).padStart(digits, '0')
}

export function totp(secret, atMs = Date.now(), stepSeconds = TOTP_STEP_SECONDS) {
  return hotp(secret, Math.floor(atMs / 1000 / stepSeconds))
}

/** Codes already accepted, so one cannot be used twice inside its window. */
const usedCounters = new Map()

function forgetExpiredCounters(now) {
  for (const [key, expiry] of usedCounters) {
    if (expiry <= now) usedCounters.delete(key)
  }
}

/**
 * Verify a six-digit code.
 *
 * @returns {{ ok: boolean, reason?: 'no-secret' | 'malformed' | 'replayed' | 'wrong' }}
 */
export function verifyTotp(secret, code, { atMs = Date.now(), account = '' } = {}) {
  if (!normaliseSecret(secret)) return { ok: false, reason: 'no-secret' }
  const digits = String(code ?? '').trim()
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(digits)) return { ok: false, reason: 'malformed' }

  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS)
  forgetExpiredCounters(atMs)

  // Every step in the window is compared, and nothing returns early: an early
  // return would let the response time say which step matched.
  let matchedStep = null
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = counter + offset
    if (sameSecret(digits, hotp(secret, step))) matchedStep = step
  }
  if (matchedStep === null) return { ok: false, reason: 'wrong' }

  const key = `${account}:${matchedStep}`
  if (usedCounters.has(key)) return { ok: false, reason: 'replayed' }
  // A code is single-use for as long as it could still be presented.
  usedCounters.set(key, atMs + (TOTP_WINDOW + 1) * TOTP_STEP_SECONDS * 1000)
  return { ok: true }
}

/** The URI an authenticator app scans. Nothing here is stored. */
export function provisioningUri(secret, accountName, issuer = "OPUDA'S PAINT enquiries") {
  const label = encodeURIComponent(`${issuer}:${accountName}`)
  return `otpauth://totp/${label}?secret=${encodeURIComponent(normaliseSecret(secret))}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`
}

/** A fresh secret, for `--new-secret`. */
export function newSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes))
}

/* --------------------------------------------------------------- sessions */

/** The signed cookie a satisfied second factor exchanges for. */
const SESSION_COOKIE = 'opd_admin'
/**
 * The signed cookie set when credentials are right but the code has not been
 * given yet.
 *
 * A browser *usually* resends Basic credentials to the same realm on the next
 * request, but "usually" is not something to build an unlock flow on — Safari
 * and a few proxies do not. So the first factor is exchanged for a short-lived
 * challenge, and the challenge plus the code is exchanged for the session.
 */
const CHALLENGE_COOKIE = 'opd_mfa'

/** How long a second-factor challenge stays valid. */
export const CHALLENGE_TTL_SECONDS = 300

/**
 * The signing key.
 *
 * `OPD_SESSION_SECRET` if set — which is what a multi-instance deployment needs,
 * so a session signed by one instance is honoured by the next. Otherwise a
 * per-boot random, which means a restart logs everybody out. That is the safer
 * default and the reason it is the default: an operator who wants sessions to
 * survive a deploy has to say so, and has to manage a secret to get it.
 */
let sessionKey = null
function signingKey() {
  const configured = (process.env.OPD_SESSION_SECRET ?? '').trim()
  if (configured) return createHash('sha256').update(configured).digest()
  sessionKey ??= randomBytes(32)
  return sessionKey
}

const base64url = (input) => Buffer.from(input).toString('base64url')
const sign = (payload) => createHmac('sha256', signingKey()).update(payload).digest('base64url')

/** @returns {string} `<payload>.<signature>` */
export function createToken({ name, role, kind = 'session' }, ttlSeconds = SESSION_TTL_SECONDS) {
  const payload = base64url(
    JSON.stringify({ u: name, r: role, k: kind, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  )
  return `${payload}.${sign(payload)}`
}

export const createSession = (identity, ttlSeconds = SESSION_TTL_SECONDS) =>
  createToken({ ...identity, kind: 'session' }, ttlSeconds)

export const createChallenge = (identity) =>
  createToken({ ...identity, kind: 'challenge' }, CHALLENGE_TTL_SECONDS)

/**
 * Read and verify a session token. Returns null when it is malformed, tampered
 * with, expired, or signed by a key this process does not have.
 */
export function readToken(token, { atMs = Date.now(), kind = 'session' } = {}) {
  const value = String(token ?? '')
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = value.slice(0, dot)
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(value.slice(dot + 1))
  // `timingSafeEqual` throws on unequal lengths, and a length is not a secret.
  if (actual.length !== expected.length) return null
  if (!timingSafeEqual(actual, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof data?.u !== 'string' || !ADMIN_ROLES.includes(data?.r)) return null
    // A challenge is not a session. Accepting one where the other was expected
    // would turn "you proved the first factor" into "you are signed in".
    if (data?.k !== kind) return null
    if (typeof data.exp !== 'number' || data.exp * 1000 <= atMs) return null
    return { name: data.u, role: data.r, expiresAt: data.exp }
  } catch {
    return null
  }
}

export function readSession(token, options) {
  return readToken(token, { ...options, kind: 'session' })
}

function cookieFromHeader(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return ''
}

/** The session on a request, if it carries a valid one. */
export function sessionFrom(req) {
  return readToken(cookieFromHeader(req.headers?.cookie, SESSION_COOKIE), { kind: 'session' })
}

/** A pending second-factor challenge on a request, if it carries a valid one. */
export function challengeFrom(req) {
  return readToken(cookieFromHeader(req.headers?.cookie, CHALLENGE_COOKIE), { kind: 'challenge' })
}

/**
 * The `Set-Cookie` header for a fresh session.
 *
 * `Secure` is set when the request arrived over TLS or a proxy says it did. When
 * it cannot be, that is logged: a session cookie over plain HTTP is the kind of
 * weakness that is invisible from inside the building.
 */
export function isSecureRequest(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] ?? '').split(',')[0].trim()
  return Boolean(req?.socket?.encrypted) || forwardedProto === 'https' || process.env.OPD_ADMIN_COOKIE_SECURE === '1'
}

/**
 * A cookie header for a signed token.
 *
 * `HttpOnly` so no script on the page can read it, `SameSite=Strict` so no other
 * site can send it, `Path=/admin` so it is not attached to the rest of the site,
 * and `Secure` whenever the request arrived over TLS — roadmap 17.01.03.
 */
export function tokenCookie(name, token, req, ttlSeconds) {
  const secure = isSecureRequest(req)
  if (!secure) {
    log.warn('admin.cookie_insecure', {
      cookie: name,
      detail: 'set without the Secure flag — the inbox should only be reachable over TLS',
    })
  }
  return [
    `${name}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/admin',
    `Max-Age=${ttlSeconds}`,
    secure ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ')
}

export const sessionCookie = (token, req, ttlSeconds = SESSION_TTL_SECONDS) =>
  tokenCookie(SESSION_COOKIE, token, req, ttlSeconds)

export const challengeCookie = (token, req) => tokenCookie(CHALLENGE_COOKIE, token, req, CHALLENGE_TTL_SECONDS)

export const clearSessionCookie = () => `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0`

export const clearChallengeCookie = () => `${CHALLENGE_COOKIE}=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0`

/* -------------------------------------------------------------- allowlist */

function ipv4ToNumber(address) {
  const parts = address.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

/** Strip an IPv4-mapped IPv6 address (`::ffff:10.0.0.1`) to its IPv4 form. */
function normaliseIp(ip) {
  const value = String(ip ?? '').trim().replace(/^\[(.+)\]$/, '$1')
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  return mapped ? mapped[1] : value
}

/**
 * Expand an IPv6 address to its 128-bit value, or null if it is not one.
 *
 * Handles `::` compression and a trailing IPv4 part, which are the two ways a
 * real address stops looking like eight colon-separated groups.
 */
function ipv6ToBigInt(address) {
  let value = String(address ?? '').trim().toLowerCase()
  const mapped = value.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) {
    const v4 = ipv4ToNumber(mapped[2])
    if (v4 === null) return null
    value = `${mapped[1]}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`
  }
  if (!value.includes(':')) return null
  if (value.split('::').length > 2) return null

  const groupsOf = (part) => (part === '' ? [] : part.split(':'))
  const valid = (groups) => groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))

  const [head, tail] = value.split('::')
  let groups
  if (tail === undefined) {
    groups = groupsOf(head)
    if (groups.length !== 8 || !valid(groups)) return null
  } else {
    const first = groupsOf(head)
    const last = groupsOf(tail)
    if (!valid(first) || !valid(last) || first.length + last.length > 7) return null
    groups = [...first, ...Array(8 - first.length - last.length).fill('0'), ...last]
  }

  return groups.reduce((total, group) => (total << 16n) | BigInt(parseInt(group, 16)), 0n)
}

function inIpv6Prefix(ip, cidr) {
  const [range, bits] = cidr.split('/')
  const address = ipv6ToBigInt(ip)
  const network = ipv6ToBigInt(range)
  if (address === null || network === null) return false
  const prefix = bits === undefined || bits === '' ? 128 : Number(bits)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false
  const shift = BigInt(128 - prefix)
  return (address >> shift) === (network >> shift)
}

/** Whether `ip` falls inside `cidr`, in either family. A mismatch is never a match. */
function inCidr(ip, cidr) {
  const entry = String(cidr ?? '').trim()
  if (!entry) return false
  if (entry.includes(':')) return inIpv6Prefix(ip, entry)

  const [range, bits] = entry.split('/')
  const address = ipv4ToNumber(ip)
  const network = ipv4ToNumber(range)
  if (address === null || network === null) return false
  if (!bits) return address === network
  const prefix = Number(bits)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false
  if (prefix === 0) return true
  const mask = (0xffffffff << (32 - prefix)) >>> 0
  return ((address >>> 0) & mask) === ((network >>> 0) & mask)
}

/** The configured allowlist, or null when there is none. */
export function allowlist() {
  const raw = (process.env.OPD_ADMIN_ALLOW_CIDR ?? '').trim()
  if (!raw) return null
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * Capability flags for `/api/health`.
 *
 * Booleans only. Health is public, and the number of accounts, their names and
 * the networks allowed to reach them are exactly what an attacker wants; whether
 * a second factor and an allowlist exist is enough for a monitor to assert that
 * a deployment is configured the way its own runbook says it should be.
 */
export function adminCapabilities() {
  const users = loadAdminUsers()
  return { mfa: users.some((user) => user.totp), allowlist: Boolean(allowlist()) }
}

/**
 * Whether an address may reach the inbox at all.
 *
 * With no allowlist configured, everyone who has credentials may — the flag is
 * an option, and a deployment on a rotating residential connection should not be
 * forced into it. Entries may be IPv4 or IPv6, a range or a single address; an
 * entry that cannot be parsed allows nothing, so a typo in this variable closes
 * the inbox rather than opening it.
 */
export function ipAllowed(ip) {
  const entries = allowlist()
  if (!entries) return true
  const address = normaliseIp(ip)
  return entries.some((entry) => inCidr(address, entry))
}

/* ------------------------------------------------------------ access log */

/**
 * Append one privileged-access decision.
 *
 * 17.01.13 asks for privileged activity to be logged. The line carries who, from
 * where, what they asked for, and the answer — never a password, never a code and
 * never an enquiry's contents, because this file outlives the shift that wrote it.
 */
export async function logAccess(entry, { dataDir } = {}) {
  const record = { at: new Date().toISOString(), ...entry }
  log.info('admin.access', {
    user: record.user ?? null,
    role: record.role ?? null,
    decision: record.decision,
    path: record.path,
  })
  if (!dataDir) return record
  try {
    await mkdir(dataDir, { recursive: true })
    await appendFile(join(dataDir, 'admin-access.jsonl'), `${JSON.stringify(record)}\n`, 'utf8')
  } catch (error) {
    // A failed audit write must not become a working admin session. Say so
    // loudly; the caller decides whether to fail closed.
    log.error('admin.access_log_failed', { message: String(error?.message ?? error) })
  }
  return record
}

/* ------------------------------------------------------------------- CLI */

const startedDirectly = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (startedDirectly && process.argv.includes('--new-secret')) {
  const label = process.argv[process.argv.indexOf('--new-secret') + 1] ?? 'administrator'
  const secret = newSecret()
  process.stdout.write(`${secret}\n${provisioningUri(secret, label)}\n`)
}
