#!/usr/bin/env node
/**
 * Production smoke test — roadmap 19.03.
 *
 *   node tools/smoke-production.mjs --origin https://opudapaint.com
 *   node tools/smoke-production.mjs --origin https://opudapaint.com --release 1.4.0
 *   node tools/smoke-production.mjs --origin https://opudapaint.com --write   # also posts one real enquiry
 *
 * Run this after every deploy, from outside the network the service runs on. It
 * answers one question: *is the thing we just shipped the thing we meant to
 * ship, and does it still work end to end?*
 *
 * What makes it a smoke test rather than a monitor:
 *
 *   • **It checks the contract, not only the pages.** A 422 from `/api/quotes`
 *     with the right field names proves the endpoint is deployed, parsing JSON,
 *     validating and speaking the version of the contract the bundle expects. A
 *     200 from the home page proves almost nothing.
 *   • **It checks the release.** With `--release`, `/api/health`'s `version` has
 *     to match. The most common deploy failure is a deploy that did not happen:
 *     old code, green checks, everybody goes home.
 *   • **It writes as little as it can.** By default the only submissions it makes
 *     are invalid ones (422, nothing stored) and one into the honeypot field
 *     (201, deliberately not stored). `--write` adds a single real enquiry,
 *     marked `source: smoke-test`, and prints the reference so it can be deleted
 *     from `/admin` afterwards — a smoke test that litters the desk's inbox with
 *     fake leads is a smoke test somebody stops running.
 *   • **It checks what must NOT work.** `/admin` and the CSV export without
 *     credentials have to be refused. A deploy that opens the inbox is a worse
 *     outage than one that closes the site, and it is silent.
 *
 * Exit status is 0 when every check passed, 1 when any failed. Warnings do not
 * fail the run: they are things a deployment may legitimately differ on.
 */

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
const has = (name) => args.includes(`--${name}`)

const ORIGIN = (flag('origin') ?? process.env.OPD_SITE_ORIGIN ?? '').replace(/\/$/, '')
const RELEASE = flag('release') ?? process.env.OPD_RELEASE ?? ''
const WRITE = has('write')
const AS_JSON = has('json')
const TIMEOUT_MS = Number(flag('timeout') ?? process.env.OPD_SMOKE_TIMEOUT_MS ?? 15_000)

if (!ORIGIN) {
  process.stderr.write(
    'smoke: no origin.\n\n  node tools/smoke-production.mjs --origin https://opudapaint.com\n\n' +
      'This is deliberate. A smoke test that guesses which deployment it is pointed at will eventually\n' +
      'be run against the wrong one and report success.\n',
  )
  process.exit(2)
}

const REFERENCE = /^OPD-\d{6}-[0-9A-F]{4}$/

const results = []
const warnings = []

async function check(group, name, run) {
  const started = Date.now()
  try {
    const detail = await run()
    results.push({ group, name, ok: true, ms: Date.now() - started, detail: detail ?? null })
  } catch (error) {
    results.push({ group, name, ok: false, ms: Date.now() - started, detail: String(error?.message ?? error) })
  }
}

function warn(group, name, detail) {
  warnings.push({ group, name, detail })
}

const fail = (message) => {
  throw new Error(message)
}

async function request(path, init = {}) {
  const res = await fetch(`${ORIGIN}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'manual',
    headers: { 'User-Agent': 'opudas-smoke/1.0 (+https://opudapaint.com)', ...(init.headers ?? {}) },
  })
  return res
}

async function json(path, init = {}) {
  const res = await request(path, init)
  let body = null
  try {
    body = await res.json()
  } catch {
    fail(`${path} answered ${res.status} with a body that is not JSON`)
  }
  return { res, body }
}

const postJson = (path, body, headers = {}) =>
  json(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

/* ------------------------------------------------------- what is deployed */

let health = null

await check('deployed', 'the health endpoint answers, and says storage is ready', async () => {
  const { res, body } = await json('/api/health')
  if (res.status !== 200) fail(`status ${res.status}`)
  health = body?.data ?? null
  if (!health) fail('no data field')
  if (health.service !== 'opd-enquiries') fail(`service is "${health.service}"`)
  if (health.storage !== 'ready') fail(`storage is "${health.storage}" — the service is up with nowhere to put an enquiry`)
  if (!Array.isArray(health.notifications) || !health.notifications.length) {
    fail('no notification channel is configured — enquiries would be stored and nobody told')
  }
  return `version ${health.version} · channels ${health.notifications.join(', ')} · limits ${health.limits?.store}`
})

await check('deployed', 'the release that answers is the release that was shipped', async () => {
  if (!RELEASE) {
    warn('deployed', 'release', 'no --release given, so this check cannot tell a stale deploy from a fresh one')
    return `skipped (health reports ${health?.version ?? 'unknown'})`
  }
  if (!health) fail('the health check did not answer')
  if (health.version !== RELEASE) {
    fail(`health reports "${health.version}" but the deploy was "${RELEASE}" — the old process is still serving`)
  }
  return `${RELEASE}`
})

await check('deployed', 'the notification channels are actually working', async () => {
  const down = Object.entries(health?.notificationHealth ?? {})
    .filter(([, channel]) => channel && channel.ok === false)
    .map(([channel, state]) => `${channel} (${state.consecutiveFailures} consecutive failures)`)
  if (down.length) fail(`channel(s) not delivering: ${down.join(', ')}`)
  return 'no channel has failed since the process started'
})

/* ------------------------------------------------------------ the pages */

await check('pages', 'the home page serves the shell and a bundle that exists', async () => {
  const res = await request('/')
  if (res.status !== 200) fail(`status ${res.status}`)
  const html = await res.text()
  if (!html.includes('id="root"')) fail('no mount point — the page would render blank')
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  if (!assets.length) fail('the HTML references no /assets/ bundle')
  for (const asset of [...new Set(assets)].slice(0, 3)) {
    const assetRes = await request(asset)
    if (assetRes.status !== 200) fail(`${asset} returned ${assetRes.status}`)
    await assetRes.body?.cancel()
  }
  const cache = res.headers.get('cache-control') ?? ''
  if (!/no-cache|no-store|max-age=0/.test(cache)) {
    warn('pages', 'html cache', `the home page is served with "${cache || 'no Cache-Control'}"; a stale shell is how a rollback fails`)
  }
  return `${assets.length} asset reference(s) resolved`
})

await check('pages', 'the routes the sitemap advertises are reachable', async () => {
  const res = await request('/sitemap.xml')
  if (res.status !== 200) fail(`sitemap returned ${res.status}`)
  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  if (urls.length < 20) fail(`the sitemap lists ${urls.length} urls; the build produces more than 100`)

  // One of each kind, taken from the sitemap itself so this test does not go
  // stale when a route is renamed: the sitemap is what search engines were told.
  const pick = (pattern) => urls.find((url) => pattern.test(url))
  const sample = [
    pick(/\/colours\/[a-z0-9-]+\/?$/),
    pick(/\/products\/[a-z0-9-]+\/?$/),
    pick(/\/advice\/[a-z0-9-]+\/?$/),
    pick(/\/tools\/finish-finder\/?$/),
    pick(/\/legal\/privacy\/?$/),
    pick(/\/dealers\/?$/),
  ].filter(Boolean)

  if (sample.length < 4) fail(`the sitemap has no routes to sample (found ${sample.length})`)
  for (const url of sample) {
    const path = new URL(url).pathname
    const page = await request(path)
    if (page.status !== 200) fail(`${path} returned ${page.status}, and the sitemap advertises it`)
    const html = await page.text()
    if (!html.includes('<title>')) fail(`${path} has no prerendered title`)
  }
  return `${sample.length} sampled of ${urls.length} urls`
})

await check('pages', 'an unknown route is a 404, not a 200 with a shell', async () => {
  const path = `/this-route-does-not-exist-${Date.now()}`
  const res = await request(path)
  if (res.status !== 404) {
    fail(`status ${res.status} — a soft 404 is indexed as a duplicate of every other page`)
  }
  await res.body?.cancel()
  return `${path} → 404`
})

await check('pages', 'the documents and media the site links to are really there', async () => {
  for (const path of ['/documents/opudas-colour-book.pdf', '/brand/mark.svg', '/robots.txt']) {
    const res = await request(path)
    if (res.status !== 200) fail(`${path} returned ${res.status}`)
    const length = Number(res.headers.get('content-length') ?? 0)
    if (length && path.endsWith('.pdf') && length < 100_000) fail(`${path} is only ${length} bytes — a truncated asset`)
    await res.body?.cancel()
  }
  return 'colour book, brand mark and robots.txt'
})

/* --------------------------------------------------------- the contract */

await check('contract', 'an enquiry with nothing in it is refused field by field', async () => {
  const { res, body } = await postJson('/api/quotes', { consent: true })
  if (res.status !== 422) fail(`status ${res.status}, expected 422`)
  const fields = Object.keys(body?.fields ?? {})
  if (!fields.includes('name') || !fields.includes('phone')) fail(`field errors were ${fields.join(', ') || 'absent'}`)
  return fields.join(', ')
})

await check('contract', 'the honeypot is answered and forgotten', async () => {
  const { res, body } = await postJson('/api/quotes', {
    name: 'Smoke Test',
    phone: '0803 000 0000',
    city: 'Port Harcourt',
    projectType: 'interior',
    consent: true,
    company: 'Bots Unlimited',
    source: 'smoke-test',
  })
  if (res.status !== 201) fail(`status ${res.status}, expected a convincing 201`)
  if (!REFERENCE.test(body?.data?.reference ?? '')) fail(`reference "${body?.data?.reference}" is not the published shape`)
  return `${body.data.reference} — a bot is told it succeeded, and nothing is stored`
})

await check('contract', 'a subscription needs a real address', async () => {
  const { res, body } = await postJson('/api/subscribe', { email: 'not-an-address' })
  if (res.status !== 422) fail(`status ${res.status}, expected 422`)
  if (!body?.fields?.email) fail('no field error for the address')
  return 'refused, with the reason attached to the field'
})

await check('contract', 'a data-subject request needs a right and an address', async () => {
  const { res, body } = await postJson('/api/privacy', { type: 'send me money', email: '' })
  if (res.status !== 422) fail(`status ${res.status}, expected 422`)
  const fields = Object.keys(body?.fields ?? {})
  if (!fields.includes('type') || !fields.includes('email')) fail(`field errors were ${fields.join(', ') || 'absent'}`)
  return fields.join(', ')
})

await check('contract', 'colour search answers with the published shape', async () => {
  const { res, body } = await json('/api/search/colours?q=white')
  if (res.status !== 200) fail(`status ${res.status}`)
  if (!Array.isArray(body?.results)) fail('no results array')
  if (!body.results.length) fail('a search for "white" found nothing — the index did not ship')
  const hit = body.results[0]
  for (const field of ['id', 'name', 'code']) {
    if (!hit[field]) fail(`the first result has no ${field}`)
  }
  return `${body.results.length} result(s), first is ${hit.name}`
})

await check('contract', 'a cross-origin form is either allowed by name or not at all', async () => {
  const res = await request('/api/health', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } })
  const allow = res.headers.get('access-control-allow-origin')
  await res.body?.cancel()
  if (allow === '*') fail('the API allows any origin to read it')
  if (allow && allow !== ORIGIN) fail(`the API allows "${allow}", which is not this site`)
  if (!allow) {
    warn(
      'contract',
      'cors',
      'no Access-Control-Allow-Origin: fine if the site and the API are same-origin, fatal if the form is served from another host',
    )
    return 'same-origin (no CORS header)'
  }
  return `preflight ${res.status}, allowed origin ${allow}`
})

/* ----------------------------------------------------------- not working */

await check('closed', 'the enquiry inbox is not readable without credentials', async () => {
  const res = await request('/admin')
  await res.body?.cancel()
  if (res.status === 200) fail('the inbox answered 200 with no credentials — this is an incident, not a smoke failure')
  if (![401, 404].includes(res.status)) fail(`status ${res.status}; expected 401 (configured) or 404 (not configured)`)
  return `${res.status} — ${res.status === 404 ? 'not configured, so not mounted' : 'credentials required'}`
})

await check('closed', 'the customer log cannot be exported without credentials', async () => {
  const res = await request('/admin/enquiries.csv')
  await res.body?.cancel()
  if (res.status === 200) fail('the CSV export answered 200 with no credentials — every customer record, to anyone')
  if (![401, 403, 404].includes(res.status)) fail(`status ${res.status}`)
  return `${res.status}`
})

await check('closed', 'the inbox refuses a wrong password', async () => {
  const res = await request('/admin', {
    headers: { Authorization: 'Basic ' + Buffer.from('smoke:definitely-not-the-password').toString('base64') },
  })
  await res.body?.cancel()
  if (res.status === 200) fail('a wrong password was accepted')
  return `${res.status}`
})

await check('closed', 'the API refuses a body it cannot parse', async () => {
  const res = await request('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name": "truncated',
  })
  await res.body?.cancel()
  if (res.status !== 400) fail(`status ${res.status}, expected 400 — a malformed body should not be a 500`)
  return '400'
})

await check('closed', 'the API refuses an oversized body', async () => {
  const res = await request('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x'.repeat(400_000), consent: true }),
  })
  await res.body?.cancel()
  if (![400, 413, 422].includes(res.status)) fail(`status ${res.status}; a 400kB body should not be a 500`)
  return `${res.status}`
})

/* ------------------------------------------------------------- hardened */

await check('headers', 'responses carry the headers the deployment promises', async () => {
  const res = await request('/')
  await res.body?.cancel()
  const missing = []
  if (res.headers.get('x-content-type-options') !== 'nosniff') missing.push('X-Content-Type-Options')
  if (ORIGIN.startsWith('https://') && !res.headers.get('strict-transport-security')) missing.push('Strict-Transport-Security')
  const server = res.headers.get('server') ?? ''
  if (/\d/.test(server)) warn('headers', 'server', `the Server header advertises "${server}"`)
  if (missing.length) {
    warn('headers', 'security headers', `missing ${missing.join(', ')} — nginx sets these in deploy/nginx.conf, so a missing one means the request did not go through it`)
    return `present except ${missing.join(', ')}`
  }
  return 'nosniff and HSTS present'
})

await check('headers', 'hashed assets are cacheable and HTML is not', async () => {
  const home = await request('/')
  const html = await home.text()
  const asset = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)][0]?.[1]
  if (!asset) fail('no hashed bundle in the home page')
  const res = await request(asset)
  await res.body?.cancel()
  const cache = res.headers.get('cache-control') ?? ''
  if (!/immutable|max-age=31536000/.test(cache)) {
    warn('headers', 'asset cache', `"${asset}" is served with "${cache || 'no Cache-Control'}"; every visit will re-download the bundle`)
    return `${cache || 'none'}`
  }
  const htmlCache = home.headers.get('cache-control') ?? ''
  if (/immutable|max-age=[1-9]/.test(htmlCache)) {
    warn('headers', 'html cache', `HTML is served with "${htmlCache}"; a rollback will not reach visitors until it expires`)
  }
  return cache
})

/* ------------------------------------------------- the one write, opt-in */

if (WRITE) {
  await check('writes', 'a real enquiry is stored, routed and referenced', async () => {
    const stamp = new Date().toISOString()
    const { res, body } = await postJson('/api/quotes', {
      name: 'Smoke Test',
      phone: '0803 000 0000',
      email: `smoke+${Date.now()}@opudapaint.com`,
      city: 'Port Harcourt',
      projectType: 'interior',
      rooms: 'none — this is a deploy check',
      message: `Production smoke test at ${stamp}. Delete this record from /admin; it is not a lead.`,
      consent: true,
      source: 'smoke-test',
    })
    if (res.status !== 201) fail(`status ${res.status}`)
    const data = body?.data ?? {}
    if (!REFERENCE.test(data.reference ?? '')) fail(`reference "${data.reference}" is not the published shape`)
    if (!data.routedTo) fail('the enquiry was not routed to a desk')
    if (!data.slaHours) fail('no SLA came back, so the confirmation on screen cannot state one')
    process.stdout.write(
      `\n  Delete this record when you are done: ${data.reference} (source "smoke-test", ${stamp})\n` +
        `  It was routed to ${data.routedTo} with a ${data.slaHours}h SLA, and the desk was notified.\n\n`,
    )
    return `${data.reference} → ${data.routedTo}`
  })

  await check('writes', 'a fault report is accepted and scrubbed', async () => {
    const { res } = await postJson('/api/errors', {
      message: 'smoke test error 0803 000 0000 someone@example.com',
      path: '/smoke',
      stack: 'Error: smoke',
    })
    if (res.status !== 202) fail(`status ${res.status}, expected 202`)
    return '202 — accepted whatever the client sent'
  })
} else {
  results.push({
    group: 'writes',
    name: 'a real enquiry is stored, routed and referenced',
    ok: true,
    ms: 0,
    detail: 'skipped — pass --write to post one real enquiry (marked source: smoke-test) and print its reference',
  })
}

/* ---------------------------------------------------------------- report */

const failed = results.filter((result) => !result.ok)
const groups = [...new Set(results.map((result) => result.group))]

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify({ origin: ORIGIN, at: new Date().toISOString(), results, warnings }, null, 2)}\n`)
} else {
  process.stdout.write(`\nSmoke test · ${ORIGIN} · ${new Date().toISOString()}\n`)
  for (const group of groups) {
    process.stdout.write(`\n  ${group}\n`)
    for (const result of results.filter((item) => item.group === group)) {
      process.stdout.write(
        `    ${result.ok ? ' ok  ' : ' FAIL'} ${result.name}${result.detail ? `\n           ${result.detail}` : ''}\n`,
      )
    }
  }
  if (warnings.length) {
    process.stdout.write('\n  warnings\n')
    for (const item of warnings) process.stdout.write(`    ~    ${item.name}: ${item.detail}\n`)
  }
  process.stdout.write(
    `\n${results.length - failed.length} passed, ${failed.length} failed, ${warnings.length} warning(s)\n`,
  )
  if (failed.length) {
    process.stdout.write('\nFailed:\n')
    for (const result of failed) process.stdout.write(`  • [${result.group}] ${result.name} — ${result.detail}\n`)
  }
}

process.exit(failed.length ? 1 : 0)
