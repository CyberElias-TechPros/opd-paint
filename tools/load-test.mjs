#!/usr/bin/env node
/**
 * Load test for the enquiry path — roadmap 18.05.
 *
 *   node tools/load-test.mjs --origin https://staging.opudapaint.com
 *   node tools/load-test.mjs --origin http://127.0.0.1:8787 --requests 500 --concurrency 25
 *   node tools/load-test.mjs --origin https://staging.opudapaint.com --scope quotes --vary-ip
 *
 * Point this at **staging**, not production. It is not a denial-of-service tool
 * and it does not try to be one, but a few hundred requests to a service that
 * also serves a shop's leads is a few hundred requests the shop did not ask for.
 *
 * Two things this test is designed around:
 *
 *   • **It writes nothing.** Submissions go in with the honeypot field filled, so
 *     the service answers exactly as it answers a real enquiry — same status, same
 *     fields, same work — and stores nothing. A load test that fills the desk's
 *     inbox with 500 fake leads is a load test that runs once.
 *   • **Rate limiting is a result, not a failure.** The enquiry endpoint allows
 *     twelve submissions per address per ten minutes, so a load test from one
 *     address *should* see 429s after the twelfth. Those are counted separately
 *     and reported as the limiter working. `--vary-ip` sends a distinct
 *     `X-Forwarded-For` per request to exercise the path past the limiter — which
 *     only means anything on a deployment that sets `OPD_TRUST_PROXY`, because
 *     otherwise the service correctly ignores a header the client made up.
 *
 * Exit status is 0 when the run met the thresholds, 1 when it did not, 2 when it
 * could not be run at all.
 */

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}
const has = (name) => args.includes(`--${name}`)
const number = (name, fallback) => {
  const value = Number(flag(name, fallback))
  if (!Number.isFinite(value) || value <= 0) {
    process.stderr.write(`load-test: --${name} has to be a positive number\n`)
    process.exit(2)
  }
  return value
}

const ORIGIN = String(flag('origin', process.env.OPD_SITE_ORIGIN ?? '')).replace(/\/$/, '')
const REQUESTS = number('requests', 120)
const CONCURRENCY = Math.min(number('concurrency', 10), 100)
const SCOPE = String(flag('scope', 'both'))
const VARY_IP = has('vary-ip')
const AS_JSON = has('json')
const P95_BUDGET_MS = number('p95', 1500)
const ERROR_BUDGET_PERCENT = Number(flag('error-rate', 1))
const TIMEOUT_MS = number('timeout', 20_000)

if (!ORIGIN) {
  process.stderr.write('load-test: --origin is required, and should be a staging host\n')
  process.exit(2)
}
if (!['health', 'quotes', 'both'].includes(SCOPE)) {
  process.stderr.write(`load-test: --scope must be health, quotes or both (got "${SCOPE}")\n`)
  process.exit(2)
}

/* --------------------------------------------------------------- payloads */

const HONEYPOT_ENQUIRY = {
  name: 'Load Test',
  phone: '0803 000 0000',
  city: 'Port Harcourt',
  projectType: 'interior',
  rooms: 'load test',
  message: 'This submission is a load test. The honeypot field is filled, so it is not stored.',
  consent: true,
  // Filled on purpose: the service answers it exactly as it answers a real
  // enquiry, and stores nothing. See the note at the top of this file.
  company: 'Load Test Bots Ltd',
  source: 'load-test',
}

let ipCounter = 0
/**
 * A distinct private-range address per request.
 *
 * Private ranges (203.0.113.0/24 is TEST-NET-3, reserved for documentation) so a
 * misconfigured deployment that trusts this header cannot be coaxed into
 * attributing traffic to a real customer's address.
 */
const nextIp = () => `203.0.113.${(ipCounter = (ipCounter + 1) % 250) + 1}`

const TARGETS = {
  health: () => ({ path: '/api/health', init: { method: 'GET' }, expected: [200] }),
  quotes: () => ({
    path: '/api/quotes',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(VARY_IP ? { 'X-Forwarded-For': nextIp() } : {}),
      },
      body: JSON.stringify(HONEYPOT_ENQUIRY),
    },
    // A 429 here is the rate limiter doing its job, and is reported separately
    // rather than counted as a failure.
    expected: [201],
    tolerated: [429],
  }),
}

const scopes = SCOPE === 'both' ? ['health', 'quotes'] : [SCOPE]

/* ------------------------------------------------------------------- run */

const percentile = (values, p) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

async function one(target) {
  const started = process.hrtime.bigint()
  try {
    const res = await fetch(`${ORIGIN}${target.path}`, {
      ...target.init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'opudas-load-test/1.0', ...(target.init.headers ?? {}) },
    })
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    // Drain the body: an unread response keeps a socket out of the pool and
    // turns a load test into a test of the agent's socket limit.
    await res.arrayBuffer()
    return { status: res.status, ms, ok: target.expected.includes(res.status), tolerated: (target.tolerated ?? []).includes(res.status) }
  } catch (error) {
    return {
      status: 0,
      ms: Number(process.hrtime.bigint() - started) / 1e6,
      ok: false,
      tolerated: false,
      error: error?.name === 'TimeoutError' ? 'timeout' : String(error?.message ?? error).slice(0, 120),
    }
  }
}

/** Run `count` requests with at most `concurrency` in flight. */
async function run(target, count, concurrency) {
  const results = []
  let issued = 0
  const startedAt = Date.now()

  async function worker() {
    for (;;) {
      if (issued >= count) return
      issued += 1
      results.push(await one(target))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker))
  const wallMs = Date.now() - startedAt

  const timings = results.map((result) => result.ms)
  const throttled = results.filter((result) => result.tolerated)
  const good = results.filter((result) => result.ok)
  const bad = results.filter((result) => !result.ok && !result.tolerated)
  const statuses = {}
  for (const result of results) statuses[result.status] = (statuses[result.status] ?? 0) + 1

  return {
    path: target.path,
    requests: results.length,
    wallMs,
    rps: results.length / (wallMs / 1000 || 1),
    statuses,
    ok: good.length,
    throttled: throttled.length,
    failed: bad.length,
    errorRate: (bad.length / results.length) * 100,
    errors: [...new Set(bad.map((result) => result.error).filter(Boolean))].slice(0, 5),
    timings: {
      min: Math.round(Math.min(...timings)),
      mean: Math.round(timings.reduce((sum, value) => sum + value, 0) / (timings.length || 1)),
      p50: Math.round(percentile(timings, 50)),
      p90: Math.round(percentile(timings, 90)),
      p95: Math.round(percentile(timings, 95)),
      p99: Math.round(percentile(timings, 99)),
      max: Math.round(Math.max(...timings)),
    },
  }
}

/* ---------------------------------------------------------------- report */

const runs = []
for (const scope of scopes) {
  const target = TARGETS[scope]()
  if (!AS_JSON) {
    process.stdout.write(`\n  ${target.path} — ${REQUESTS} requests, ${CONCURRENCY} concurrent\n`)
  }
  // A short warm-up: the first request pays for TLS, a cold cache and the first
  // read of the data file, and including it skews the tail of a small run.
  await one(target)
  runs.push(await run(target, REQUESTS, CONCURRENCY))
}

const failures = []
for (const result of runs) {
  if (result.timings.p95 > P95_BUDGET_MS) failures.push(`${result.path}: p95 ${result.timings.p95}ms is over the ${P95_BUDGET_MS}ms budget`)
  if (result.errorRate > ERROR_BUDGET_PERCENT) {
    failures.push(`${result.path}: ${result.errorRate.toFixed(1)}% of requests failed (budget ${ERROR_BUDGET_PERCENT}%)`)
  }
}

if (AS_JSON) {
  process.stdout.write(
    `${JSON.stringify({ origin: ORIGIN, at: new Date().toISOString(), requests: REQUESTS, concurrency: CONCURRENCY, varyIp: VARY_IP, runs, failures }, null, 2)}\n`,
  )
} else {
  process.stdout.write(`\nLoad test · ${ORIGIN} · ${new Date().toISOString()}\n`)
  for (const result of runs) {
    process.stdout.write(`\n  ${result.path}\n`)
    process.stdout.write(`    ${result.requests} requests in ${result.wallMs}ms · ${result.rps.toFixed(1)} req/s\n`)
    process.stdout.write(`    statuses  ${Object.entries(result.statuses).map(([status, count]) => `${status}×${count}`).join('  ')}\n`)
    process.stdout.write(
      `    timings   min ${result.timings.min} · mean ${result.timings.mean} · p50 ${result.timings.p50} · p90 ${result.timings.p90} · p95 ${result.timings.p95} · p99 ${result.timings.p99} · max ${result.timings.max} (ms)\n`,
    )
    if (result.throttled) {
      // The run diagnoses its own caveat: if the addresses were varied and the
      // limiter still counted them as one, the deployment does not trust the
      // header, and the numbers are one address's budget rather than throughput.
      const diagnosis = VARY_IP
        ? 'Addresses were varied and the limiter still counted them together, so this deployment does not trust X-Forwarded-For (OPD_TRUST_PROXY is unset) — what was measured is one address\'s budget, not throughput.'
        : 'Pass --vary-ip to exercise the path past the limiter.'
      process.stdout.write(`    throttled ${result.throttled} × 429 — the rate limiter answered, which is it working. ${diagnosis}\n`)
    } else if (VARY_IP) {
      process.stdout.write('    throttled none — addresses were varied and the deployment trusts X-Forwarded-For, so the limiter was genuinely bypassed\n')
    }
    if (result.failed) {
      process.stdout.write(`    failed    ${result.failed} (${result.errorRate.toFixed(1)}%)\n`)
      for (const error of result.errors) process.stdout.write(`              ↳ ${error}\n`)
    }
  }
  process.stdout.write(`\n${failures.length ? 'FAILED\n' : 'PASSED\n'}`)
  for (const failure of failures) process.stdout.write(`  • ${failure}\n`)
  if (VARY_IP) {
    process.stdout.write(
      '  note: --vary-ip only measures anything on a deployment that sets OPD_TRUST_PROXY.\n' +
        '        Anywhere else the service ignores the header, correctly, and every request shares one bucket.\n',
    )
  }
}

process.exit(failures.length ? 1 : 0)
