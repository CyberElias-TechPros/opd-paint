/**
 * Notifications: make sure a human hears about an enquiry.
 *
 * Writing a lead to a JSONL file and telling nobody is the single most common
 * way a lead-generation site fails — quietly. This module is the fix, built to
 * three rules:
 *
 *  1. **The enquiry is already safe before this runs.** Notifications happen
 *     after the record is persisted and after the visitor has their reference
 *     number. Nothing here can turn a successful enquiry into an error.
 *  2. **Never block the response.** The visitor's 201 is sent first; delivery
 *     happens afterwards. A dead Slack webhook must not add three seconds to a
 *     form submission on a 3G connection.
 *  3. **Failures are recorded, not swallowed.** Every attempt is appended to
 *     `notifications.jsonl`, and a failure is retried in-process a few times
 *     before being marked failed for a human or cron to pick up.
 *
 * Channels are configuration, not code — no vendor SDK, no dependency:
 *
 *   OPD_NOTIFY_WEBHOOK   Any URL that accepts a JSON POST: Slack, Discord,
 *                        Teams, Zapier, Make, n8n, or your own endpoint.
 *                        Receives `{ text, record, routing }`.
 *   OPD_RESEND_API_KEY   Resend (https://resend.com) transactional email.
 *   OPD_NOTIFY_EMAIL     Who receives the email (comma-separated).
 *   OPD_NOTIFY_FROM      Verified sender, e.g. "OPUDA'S PAINT <enquiries@…>".
 *
 * With nothing configured the service still works; it simply cannot notify, and
 * says so at startup and in `/api/health`.
 */
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

import { log } from './logger.mjs'

// Retries are cheap insurance against a webhook that blipped. The delay is
// overridable so tests do not have to sleep through it.
const RETRY_DELAYS_MS = (process.env.OPD_NOTIFY_RETRY_MS ?? '500,2000')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0)
const TIMEOUT_MS = 8000

const config = () => ({
  webhook: (process.env.OPD_NOTIFY_WEBHOOK ?? '').trim(),
  resendKey: (process.env.OPD_RESEND_API_KEY ?? '').trim(),
  emailTo: (process.env.OPD_NOTIFY_EMAIL ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean),
  emailFrom: (process.env.OPD_NOTIFY_FROM ?? '').trim(),
})

/** Channel names that are switched on, safe to expose in `/api/health`. */
export function configuredChannels() {
  const current = config()
  const channels = []
  if (current.webhook) channels.push('webhook')
  if (current.resendKey && current.emailTo.length && current.emailFrom) channels.push('email')
  return channels
}

/* ------------------------------------------------------------------ payload */

/**
 * The human message.
 *
 * Deliberately written for a phone screen: reference and project type first,
 * because that is what the desk writes down when the call comes in. The full
 * record travels alongside for anything that wants structure.
 */
export function summarise(record, routing) {
  const lines = [
    `New ${record.projectType} enquiry — ${record.reference}`,
    '',
    `${record.name} · ${record.phone}`,
    `${record.city}`,
    routing ? `Routed to: ${routing.routedTo} (${routing.slaHours}h SLA)` : null,
    record.colors?.length ? `Colours: ${record.colors.join(', ')}` : null,
    record.products?.length ? `Products: ${record.products.join(', ')}` : null,
    record.message ? `\n"${record.message.slice(0, 500)}"` : null,
    record.email ? `\nReply to: ${record.email}` : null,
  ]
  return lines.filter((line) => line !== null).join('\n')
}

function webhookPayload(record, routing) {
  const text = summarise(record, routing)
  return {
    // `text` is understood by Slack, Discord, Teams and most chat webhooks.
    text,
    // Everything else is for Zapier/Make/custom endpoints.
    record,
    routing,
    source: "OPUDA'S PAINT website",
  }
}

function emailPayload(record, routing, current) {
  const text = summarise(record, routing)
  return {
    from: current.emailFrom,
    to: current.emailTo,
    subject: `${record.projectType} enquiry ${record.reference} — ${record.city}`,
    text,
    reply_to: record.email || undefined,
  }
}

/* ----------------------------------------------------------------- delivery */

async function postOnce(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status} ${detail.slice(0, 300)}`.trim())
  }
  return response
}

async function withRetries(label, attempt) {
  let lastError
  for (let index = 0; index <= RETRY_DELAYS_MS.length; index += 1) {
    try {
      await attempt()
      return { ok: true }
    } catch (error) {
      lastError = error
      log.warn('notify.attempt_failed', { channel: label, attempt: index + 1, error: String(error) })
      const delay = RETRY_DELAYS_MS[index]
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  return { ok: false, error: String(lastError) }
}

function deliveries(record, routing) {
  const current = config()
  const senders = []

  if (current.webhook) {
    senders.push([
      'webhook',
      () =>
        postOnce(current.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload(record, routing)),
        }),
    ])
  }

  if (current.resendKey && current.emailTo.length && current.emailFrom) {
    senders.push([
      'email',
      () =>
        postOnce('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${current.resendKey}`,
          },
          body: JSON.stringify(emailPayload(record, routing, current)),
        }),
    ])
  }

  return senders
}

/**
 * Deliver the notification for one enquiry. Resolves to a per-channel result;
 * it never rejects, so callers can `void notifyEnquiry(...)` safely.
 */
export async function notifyEnquiry(record, routing, { dataDir } = {}) {
  const senders = deliveries(record, routing)
  if (!senders.length) {
    log.debug('notify.skipped', { reference: record.reference, reason: 'no channels configured' })
    return { configured: false, results: [] }
  }

  const results = await Promise.all(
    senders.map(async ([channel, send]) => {
      const outcome = await withRetries(channel, send)
      log[outcome.ok ? 'info' : 'error']('notify.delivered', {
        reference: record.reference,
        channel,
        ok: outcome.ok,
        ...(outcome.ok ? {} : { error: outcome.error }),
      })
      return { channel, ...outcome }
    }),
  )

  // The audit line is metadata only: channel, outcome, reference. The enquiry
  // itself already lives in quotes.jsonl; it does not need a second copy.
  if (dataDir) {
    try {
      await appendFile(
        join(dataDir, 'notifications.jsonl'),
        `${JSON.stringify({
          at: new Date().toISOString(),
          reference: record.reference,
          results: results.map(({ channel, ok, error }) => ({ channel, ok, ...(error ? { error } : {}) })),
        })}\n`,
        'utf8',
      )
    } catch (error) {
      log.error('notify.audit_failed', { reference: record.reference, error: String(error) })
    }
  }

  return { configured: true, results }
}
