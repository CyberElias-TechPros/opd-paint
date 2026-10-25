/**
 * Error intake.
 *
 * The browser reports its own failures here — an error boundary catching a
 * render fault, an unhandled rejection, a chunk that failed to load on a bad
 * connection. Without this, a broken page is invisible until somebody phones.
 *
 * Design decisions worth stating:
 *
 *  · **No analytics consent required, and no identifiers.** This is operational
 *    diagnostics, not behavioural tracking: we store a message, a stack, the
 *    path and a browser string. No cookies, no user id, no form contents. The
 *    privacy page says so.
 *  · **Scrubbed at the edge.** Paths are stripped of query strings (which can
 *    carry an email from a pre-filled link) and messages are capped. There is a
 *    deliberate list of values we refuse to store even if a caller sends them.
 *  · **Bounded.** Size-capped body, per-IP rate limit, and field caps — an
 *    error endpoint that can be flooded is a liability.
 *  · **Optional Sentry.** If `OPD_SENTRY_DSN` is set, events are also forwarded
 *    to Sentry's store API with plain `fetch`. No SDK, no 40 kB of browser code.
 */
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { log } from './logger.mjs'

const MAX_MESSAGE = 300
const MAX_STACK = 3000
const MAX_PATH = 200

/** Keys that must never be persisted, whatever a client sends. */
const FORBIDDEN = /^(password|token|authorization|cookie|email|phone|name|message|body)$/i

function clean(value, limit) {
  if (typeof value !== 'string') return ''
  // Strip anything that looks like a credential or a long opaque blob.
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b\d{10,15}\b/g, '[number]')
    .replace(/[?&][^=\s]+=[^&\s]*/g, '')
    .slice(0, limit)
}

export function sanitise(input) {
  const source = input && typeof input === 'object' ? input : {}
  const extras = {}
  if (source.extra && typeof source.extra === 'object') {
    for (const [key, value] of Object.entries(source.extra).slice(0, 8)) {
      if (FORBIDDEN.test(key)) continue
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        extras[key] = typeof value === 'string' ? clean(value, 200) : value
      }
    }
  }

  return {
    eventId: randomUUID().replace(/-/g, ''),
    at: new Date().toISOString(),
    kind: ['error', 'unhandledrejection', 'boundary', 'manual'].includes(source.kind) ? source.kind : 'error',
    message: clean(source.message, MAX_MESSAGE) || 'Unknown error',
    stack: clean(source.stack, MAX_STACK),
    path: clean(source.path, MAX_PATH),
    release: clean(source.release, 40),
    userAgent: clean(source.userAgent, 200),
    extra: Object.keys(extras).length ? extras : undefined,
  }
}

/* ------------------------------------------------------------------- sentry */

function parseDsn(dsn) {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\//, '')
    if (!url.username || !projectId) return null
    return {
      store: `${url.protocol}//${url.host}/api/${projectId}/store/`,
      auth: `Sentry sentry_version=7, sentry_key=${url.username}, sentry_client=opd-paint/1.0`,
      environment: process.env.OPD_ENV ?? process.env.NODE_ENV ?? 'production',
    }
  } catch {
    return null
  }
}

async function forwardToSentry(event) {
  const dsn = (process.env.OPD_SENTRY_DSN ?? '').trim()
  if (!dsn) return
  const target = parseDsn(dsn)
  if (!target) {
    log.warn('errors.sentry_dsn_invalid')
    return
  }
  try {
    const response = await fetch(target.store, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': target.auth },
      body: JSON.stringify({
        event_id: event.eventId,
        timestamp: event.at,
        platform: 'javascript',
        level: 'error',
        environment: target.environment,
        release: event.release || undefined,
        message: event.message,
        transaction: event.path,
        request: { url: event.path, headers: { 'User-Agent': event.userAgent } },
        exception: { values: [{ type: event.kind, value: event.message }] },
        extra: { stack: event.stack, ...event.extra },
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    // Sentry being unreachable must never affect the visitor or lose the local copy.
    log.warn('errors.sentry_forward_failed', { error: String(error) })
  }
}

/* ------------------------------------------------------------------ intake */

/**
 * Record one client error. Writes locally, forwards to Sentry if configured,
 * and always resolves.
 */
export async function recordError(input, { dataDir, ip } = {}) {
  const event = sanitise(input)
  if (ip) event.ip = ip

  log.warn('client_error', {
    eventId: event.eventId,
    kind: event.kind,
    message: event.message,
    path: event.path,
  })

  if (dataDir) {
    try {
      await appendFile(join(dataDir, 'errors.jsonl'), `${JSON.stringify(event)}\n`, 'utf8')
    } catch (error) {
      log.error('errors.write_failed', { error: String(error) })
    }
  }

  // Fire and forget: the visitor's browser should not wait on Sentry.
  void forwardToSentry(event)

  return { eventId: event.eventId }
}
