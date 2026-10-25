/**
 * Client error telemetry.
 *
 * What this is: an operational smoke alarm. When a page breaks in the wild, we
 * want a line in a log with enough context to reproduce it — not a dashboard of
 * user behaviour.
 *
 * What this deliberately is not:
 *  • **Not analytics.** It is not gated on consent because it stores nothing
 *    about a person — no identifiers, no cookies, no session, no path query
 *    strings (which can carry an email from a shared link). The privacy page
 *    describes it in those terms.
 *  • **Not a dependency.** A `fetch`/`sendBeacon` to our own `/api/errors`.
 *    Bundling a 40 kB SDK to send a stack trace is a poor trade on a site whose
 *    whole argument is speed on a Nigerian mobile connection.
 *  • **Not allowed to break anything.** Every entry point is wrapped; a failure
 *    to report is silently a failure to report.
 *
 * Noise control matters more than it sounds: a render loop can fire an error
 * hundreds of times a second, and the endpoint has a rate limit that would then
 * punish every other visitor behind the same NAT. So repeats are collapsed by
 * fingerprint and the page session is capped.
 */

export type ReportKind = 'error' | 'unhandledrejection' | 'boundary' | 'manual'

export interface ErrorReport {
  kind: ReportKind
  message: string
  stack?: string
  path?: string
  release?: string
  userAgent?: string
  extra?: Record<string, string | number | boolean>
}

/** Build identity, so a stack trace can be matched to a deploy. */
export const RELEASE = (import.meta.env.VITE_RELEASE as string | undefined) ?? 'dev'

const ENDPOINT = '/api/errors'
const MAX_PER_SESSION = 8
const DEDUPE_WINDOW_MS = 60_000

const seen = new Map<string, number>()
let sent = 0
let installed = false

function fingerprint(report: ErrorReport): string {
  return `${report.kind}|${report.message}|${report.path ?? ''}`
}

function shouldSend(report: ErrorReport): boolean {
  const key = fingerprint(report)
  const now = Date.now()
  const last = seen.get(key)
  if (last && now - last < DEDUPE_WINDOW_MS) return false
  seen.set(key, now)
  return sent < MAX_PER_SESSION
}

/**
 * Send one report. Returns whether it was handed to the network. Never throws.
 */
export function reportError(report: ErrorReport): boolean {
  try {
    // Development noise is the developer's own console's job.
    if (import.meta.env.DEV) return false
    if (!shouldSend(report)) return false

    const body = JSON.stringify({
      kind: report.kind,
      message: report.message,
      // Cap generously on the client; the server caps again and scrubs.
      stack: report.stack?.slice(0, 3000),
      // Path only — never the query string, which can carry an email from a
      // shared link. The server drops it again; two independent places would
      // have to be wrong for a leak to happen.
      path: window.location.pathname,
      release: RELEASE,
      userAgent: navigator.userAgent,
      extra: report.extra,
    })

    sent += 1

    if ('sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return true
    }

    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* the reporter is not allowed to fail loudly */
    })
    return true
  } catch {
    return false
  }
}

/** Report a React error-boundary catch. */
export function reportBoundaryError(error: Error, componentStack?: string): void {
  reportError({
    kind: 'boundary',
    message: error.message || String(error),
    stack: componentStack ?? error.stack,
    path: window.location.pathname,
    release: RELEASE,
    userAgent: navigator.userAgent,
  })
}

/**
 * Install the global listeners. Called once, from `main.tsx`.
 *
 * Deliberately excludes resource errors (a failed image is not an incident) and
 * errors from other origins (opaque and unfixable by us).
 */
export function installErrorReporting(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    // A failed <img> or <script> is a resource error, not a code fault.
    if (event.target instanceof HTMLElement) return
    const error = event.error instanceof Error ? event.error : null
    reportError({
      kind: 'error',
      message: error?.message ?? event.message ?? 'Unknown error',
      stack: error?.stack,
      path: window.location.pathname,
      release: RELEASE,
      userAgent: navigator.userAgent,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const error = reason instanceof Error ? reason : null
    reportError({
      kind: 'unhandledrejection',
      message: error?.message ?? String(reason).slice(0, 300),
      stack: error?.stack,
      path: window.location.pathname,
      release: RELEASE,
      userAgent: navigator.userAgent,
    })
  })
}

/** Test seam: reset the session counters. */
export function resetTelemetryForTests(): void {
  seen.clear()
  sent = 0
  installed = false
}
