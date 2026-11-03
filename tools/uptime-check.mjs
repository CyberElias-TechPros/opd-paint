#!/usr/bin/env node
/**
 * Uptime check — roadmap 17.03.01 to 17.03.06.
 *
 *   node tools/uptime-check.mjs                       # check the live site
 *   node tools/uptime-check.mjs --origin http://127.0.0.1:8787
 *   OPD_UPTIME_HEARTBEAT=https://hc-ping.com/xxxx node tools/uptime-check.mjs
 *
 * Three ideas, in the order they matter:
 *
 *   1. **A check asserts something about the page, not only its status.** A
 *      deploy that serves a blank shell returns 200 forever. Each probe below
 *      carries a marker that has to be in the body — `<h1`, a brand string, a
 *      PDF's content length — so "up" means "serving the thing it is for".
 *   2. **Health is checked as data.** `/api/health` says whether storage is
 *      ready and which notification channels are configured. A service that is
 *      up, has lost its disk, and can no longer tell the desk about an enquiry is
 *      down for every purpose that matters, and a status-code monitor calls it
 *      healthy.
 *   3. **A dead monitor is a failure too.** With `OPD_UPTIME_HEARTBEAT` set
 *      (Healthchecks.io, Cronitor, Uptime Kuma — anything that pages when a ping
 *      *stops*), this script pings only when every check passed. If the cron job,
 *      the host or this script dies, the heartbeat stops and the alerting service
 *      raises it. Without that, a monitor that has quietly stopped running looks
 *      exactly like a site that is up.
 *
 * Exit status is 0 when everything passed and 1 otherwise, so cron, CI or a
 * systemd timer can alert on it directly.
 */

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
const has = (name) => args.includes(`--${name}`)

const ORIGIN = (flag('origin') ?? process.env.OPD_SITE_ORIGIN ?? 'https://opudapaint.com').replace(/\/$/, '')
const HEARTBEAT = (flag('heartbeat') ?? process.env.OPD_UPTIME_HEARTBEAT ?? '').trim()
const WEBHOOK = (process.env.OPD_NOTIFY_WEBHOOK ?? '').trim()
const TIMEOUT_MS = Number(flag('timeout') ?? process.env.OPD_UPTIME_TIMEOUT_MS ?? 10_000)
const MAX_MS = Number(flag('max-ms') ?? process.env.OPD_UPTIME_MAX_MS ?? 4000)
const AS_JSON = has('json')

/**
 * What "up" means, route by route.
 *
 * `expect` runs against the body (or the response, for binary assets) and returns
 * a string describing the failure, or null. Keeping the assertions next to the
 * URLs is what stops this file drifting into a list of pings.
 */
const CHECKS = [
  {
    name: 'home',
    path: '/',
    expect: { status: 200, maxMs: MAX_MS, type: 'text/html', shell: true, title: "OPUDA", assets: true },
    why: 'the front door; a blank shell here is an outage nobody can see from a status code',
  },
  {
    name: 'quote',
    path: '/quote',
    expect: { status: 200, maxMs: MAX_MS, type: 'text/html', shell: true, title: 'quote', assets: true },
    why: 'the page that earns money; if this is broken the rest of the site is decoration',
  },
  {
    name: 'privacy-notice',
    path: '/legal/privacy',
    expect: { status: 200, maxMs: MAX_MS, type: 'text/html', shell: true, title: 'Privacy notice', assets: true },
    why: 'a legal document that has to be reachable, with the title the prerendered head promises',
  },
  {
    name: 'api-health',
    path: '/api/health',
    expect: { status: 200, maxMs: 2500, type: 'application/json' },
    json: (body) => {
      const data = body?.data
      if (!data) return 'the health check answered without a data field'
      // `absent`/`not-created-yet` means the service is running with nowhere to
      // put an enquiry: it will answer 200 and lose every lead.
      if (data.storage !== 'ready') return `storage is "${data.storage}" — enquiries cannot be written`
      if (!Array.isArray(data.notifications) || data.notifications.length === 0) {
        return 'no notification channel is configured — enquiries are stored and nobody is told'
      }
      if (data.damagedRecords > 0) return `${data.damagedRecords} damaged record(s) in the enquiry log`
      const down = Object.entries(data.notificationHealth ?? {})
        .filter(([, channel]) => channel && channel.ok === false && (channel.consecutiveFailures ?? 0) >= 3)
        .map(([channel]) => channel)
      if (down.length) return `notification channel(s) down: ${down.join(', ')}`
      return null
    },
    why: 'the service, its disk and its ability to tell the desk about an enquiry',
  },
  {
    name: 'colour-book',
    path: '/documents/opudas-colour-book.pdf',
    expect: { status: 200, maxMs: 15_000, type: 'application/pdf', minBytes: 100_000 },
    why: 'the biggest asset on the site; a truncated or missing PDF is invisible to a status check',
  },
  {
    name: 'sitemap',
    path: '/sitemap.xml',
    expect: { status: 200, maxMs: MAX_MS, contains: ['<urlset'], type: 'application/xml' },
    why: 'how search engines find the site; it breaks silently and costs traffic for weeks',
  },
]

/**
 * What "up" means for this site, and why it is not `<h1>`.
 *
 * The app is a Vite SPA whose *heads* are prerendered (110 of them) and whose
 * bodies are rendered in the browser. A probe that looked for page copy in the
 * HTML would fail against a perfectly healthy deployment — and a monitor that
 * cries wolf is a monitor somebody switches off. What the served HTML does
 * guarantee is: the mount point, the prerendered title and description, and the
 * hashed bundle URLs it asks the browser to load. A deploy that serves HTML
 * pointing at a chunk that no longer exists is the classic blank-page failure,
 * and it is exactly what `assets: true` below goes and fetches.
 */

/* ------------------------------------------------------------------ probe */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function probe(check) {
  const url = `${ORIGIN}${check.path}`
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'opudas-uptime-check/1.0 (+https://opudapaint.com)' },
    })
    const ms = Date.now() - started
    const problems = []

    if (res.status !== check.expect.status) {
      problems.push(`status ${res.status}, expected ${check.expect.status}`)
    }
    if (ms > check.expect.maxMs) {
      problems.push(`${ms}ms, over the ${check.expect.maxMs}ms budget`)
    }
    const type = res.headers.get('content-type') ?? ''
    if (check.expect.type && !type.includes(check.expect.type)) {
      problems.push(`content type "${type || 'none'}", expected ${check.expect.type}`)
    }

    const raw = await res.arrayBuffer()
    if (check.expect.minBytes && raw.byteLength < check.expect.minBytes) {
      problems.push(`${raw.byteLength} bytes, under the ${check.expect.minBytes} minimum — a truncated asset`)
    }

    const bodyText = check.expect.type === 'application/pdf' ? '' : new TextDecoder().decode(raw).slice(0, 400_000)

    for (const marker of check.expect.contains ?? []) {
      if (!bodyText.includes(marker)) problems.push(`the body does not contain "${marker}"`)
    }
    if (check.expect.shell && !bodyText.includes('id="root"')) {
      problems.push('no mount point in the HTML — the shell is broken, so the page renders blank')
    }
    if (check.expect.title) {
      const title = bodyText.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
      if (!title) problems.push('no <title> — the prerendered head is missing')
      else if (!title.includes(check.expect.title)) problems.push(`the title is "${title}", expected it to contain "${check.expect.title}"`)
      if (!bodyText.includes('name="description"')) problems.push('no meta description — search results will invent one')
    }

    // The bundle the page asks for has to exist. This is the check that catches a
    // half-finished deploy: HTML from the new build, assets from the old one.
    if (check.expect.assets) {
      const referenced = [...bodyText.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
      if (!referenced.length) {
        problems.push('the HTML references no /assets/ bundle — the build did not make it into the response')
      }
      for (const asset of [...new Set(referenced)].slice(0, 4)) {
        try {
          const assetRes = await fetch(`${ORIGIN}${asset}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
          if (assetRes.status !== 200) {
            problems.push(`${asset} returned ${assetRes.status} — the page would render blank`)
            await assetRes.body?.cancel()
            continue
          }
          // Size is not a proxy for integrity: a code-split chunk can legitimately
          // be a few hundred bytes. What is never legitimate is a body shorter
          // than the length the server announced, or an empty one.
          const received = (await assetRes.arrayBuffer()).byteLength
          const announced = Number(assetRes.headers.get('content-length') ?? 0)
          if (!received) problems.push(`${asset} came back empty`)
          else if (announced && announced !== received) {
            problems.push(`${asset} announced ${announced} bytes and delivered ${received} — a truncated bundle`)
          }
        } catch (error) {
          problems.push(`${asset} could not be fetched: ${String(error?.message ?? error).slice(0, 100)}`)
        }
      }
    }

    if (check.json) {
      let parsed = null
      try {
        parsed = JSON.parse(bodyText)
      } catch {
        problems.push('the body is not valid JSON')
      }
      const finding = parsed ? check.json(parsed) : null
      if (finding) problems.push(finding)
    }

    return {
      name: check.name,
      path: check.path,
      url,
      ok: problems.length === 0,
      ms,
      status: res.status,
      bytes: raw.byteLength,
      problems,
      why: check.why,
    }
  } catch (error) {
    return {
      name: check.name,
      path: check.path,
      url,
      ok: false,
      ms: Date.now() - started,
      status: 0,
      bytes: 0,
      problems: [
        error?.name === 'AbortError'
          ? `no response within ${TIMEOUT_MS}ms`
          : `could not be reached: ${String(error?.message ?? error).slice(0, 160)}`,
      ],
      why: check.why,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function pingHeartbeat(results) {
  if (!HEARTBEAT) return
  const failed = results.filter((result) => !result.ok)
  // A dead-man's switch is pinged on success. Pinging on failure too would turn
  // "the monitor stopped running" and "the site is down" into the same silence.
  if (failed.length) return
  try {
    await fetch(HEARTBEAT, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    // Not fatal, and not silent: the next missing heartbeat is the alert.
    process.stderr.write(`uptime: could not reach the heartbeat at ${HEARTBEAT.replace(/[?#].*$/, '?…')}\n`)
  }
}

async function alert(results) {
  const failed = results.filter((result) => !result.ok)
  if (!failed.length || !WEBHOOK) return
  const text = [
    `Site check failed for ${ORIGIN} — ${failed.length} of ${results.length} checks.`,
    '',
    ...failed.map((result) => `• ${result.path} — ${result.problems.join('; ')}`),
    '',
    'Each line above is the reason it matters:',
    ...failed.map((result) => `• ${result.path}: ${result.why}`),
  ].join('\n')
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'uptime-check', origin: ORIGIN }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    process.stderr.write(`uptime: the alert could not be delivered: ${String(error?.message ?? error)}\n`)
  }
}

/* ------------------------------------------------------------------- main */

const only = flag('only')
const selected = only ? CHECKS.filter((check) => check.name === only || check.path === only) : CHECKS
if (!selected.length) {
  process.stderr.write(`uptime: no check named "${only}". Known checks: ${CHECKS.map((check) => check.name).join(', ')}\n`)
  process.exit(2)
}

// Probed in parallel: a slow route should not delay the discovery that another
// one is down. Retries are deliberately absent — a monitor that retries hides the
// intermittent failure that is worth being woken up for.
const results = await Promise.all(selected.map(probe))

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify({ origin: ORIGIN, at: new Date().toISOString(), results }, null, 2)}\n`)
} else {
  const failed = results.filter((result) => !result.ok)
  process.stdout.write(`\nUptime check · ${ORIGIN} · ${new Date().toISOString()}\n\n`)
  for (const result of results) {
    const mark = result.ok ? ' ok  ' : ' FAIL'
    process.stdout.write(`  ${mark} ${result.path.padEnd(38)} ${String(result.status).padStart(3)}  ${String(result.ms).padStart(5)}ms\n`)
    for (const problem of result.problems) process.stdout.write(`         ↳ ${problem}\n`)
  }
  process.stdout.write(
    `\n${results.length - failed.length} passed, ${failed.length} failed` +
      (HEARTBEAT ? (failed.length ? ' · heartbeat not pinged' : ' · heartbeat pinged') : ' · no heartbeat configured') +
      '\n',
  )
  if (!HEARTBEAT) {
    process.stdout.write(
      '  Set OPD_UPTIME_HEARTBEAT to a dead-man\'s-switch URL: without it, a monitor that stops running\n' +
        '  is indistinguishable from a site that is up.\n',
    )
  }
}

await pingHeartbeat(results)
await alert(results)

process.exit(results.every((result) => result.ok) ? 0 : 1)
