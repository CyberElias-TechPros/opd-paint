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
  /**
   * Where transactional email is posted.
   *
   * The default is Resend's endpoint. The variable exists for two reasons: a
   * test can point it at a local server and watch what the service actually
   * sends, and a deployment that changes vendor changes one configuration line
   * rather than three call sites.
   */
  resendUrl: (process.env.OPD_RESEND_URL ?? '').trim() || 'https://api.resend.com/emails',
})

/** Channel names that are switched on, safe to expose in `/api/health`. */
export function configuredChannels() {
  const current = config()
  const channels = []
  if (current.webhook) channels.push('webhook')
  if (current.resendKey && current.emailTo.length && current.emailFrom) channels.push('email')
  return channels
}

/* --------------------------------------------------------- channel health */

/**
 * Roadmap 17.03.05: monitor third-party integration failures.
 *
 * A webhook that has been dead for three days is indistinguishable from a quiet
 * week unless something counts. This holds the last outcome per channel in
 * memory — enough for `/api/health` to report and for a monitor to alert on, and
 * deliberately not enough to be a second log (that is `notifications.jsonl`).
 */
const channels = new Map()

/** Consecutive failures before a channel is called down rather than flaky. */
const DOWN_AFTER = (() => {
  const configured = Number(process.env.OPD_NOTIFY_DOWN_AFTER)
  return Number.isFinite(configured) && configured >= 1 ? configured : 3
})()

function recordOutcome(channel, outcome) {
  const previous =
    channels.get(channel) ??
    { ok: true, consecutiveFailures: 0, failures: 0, delivered: 0, lastFailureAt: null, lastOkAt: null, lastError: null }
  const next = {
    ...previous,
    ok: outcome.ok,
    consecutiveFailures: outcome.ok ? 0 : previous.consecutiveFailures + 1,
    failures: previous.failures + (outcome.ok ? 0 : 1),
    delivered: previous.delivered + (outcome.ok ? 1 : 0),
    lastOkAt: outcome.ok ? new Date().toISOString() : previous.lastOkAt,
    lastFailureAt: outcome.ok ? previous.lastFailureAt : new Date().toISOString(),
    lastError: outcome.ok ? null : String(outcome.error ?? '').slice(0, 200),
  }
  channels.set(channel, next)
  if (!outcome.ok && next.consecutiveFailures === DOWN_AFTER) {
    // `error`, not `warn`: this is the line an alert should be built on. Enquiries
    // are still being stored, but nobody is being told about them.
    log.error('notify.channel_down', {
      channel,
      consecutiveFailures: next.consecutiveFailures,
      detail: `no ${channel} delivery has succeeded ${DOWN_AFTER} times in a row — enquiries are being stored, and nobody is being alerted`,
    })
  }
}

/**
 * Per-channel delivery state, safe to publish.
 *
 * Counts and timestamps only: no webhook URL, no API key, no recipient address.
 * `/api/health` is public.
 */
export function channelHealth() {
  const summary = {}
  for (const [channel, state] of channels) {
    summary[channel] = {
      ok: state.ok,
      consecutiveFailures: state.consecutiveFailures,
      delivered: state.delivered,
      failures: state.failures,
      lastOkAt: state.lastOkAt,
      lastFailureAt: state.lastFailureAt,
    }
  }
  return summary
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
        postOnce(current.resendUrl, {
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

/* --------------------------------------------------- the customer's copy */

/**
 * Whether the visitor gets an acknowledgement.
 *
 * On by default when a working email channel exists, because a form that hands
 * over a reference number and then goes silent is a form people do not trust —
 * and roadmap 14.02.05 asks for transactional email to the customer. It is one
 * message about the enquiry they just made, sent to the address they gave for
 * that purpose, with no marketing in it and a sentence at the end saying plainly
 * that nothing else will follow. `OPD_ACK_CUSTOMER=off` turns it off.
 */
function acknowledgementEnabled(current) {
  const configured = (process.env.OPD_ACK_CUSTOMER ?? 'on').trim().toLowerCase()
  if (['off', 'false', '0', 'no'].includes(configured)) return false
  return Boolean(current.resendKey && current.emailFrom)
}

export function acknowledgementText(record, routing) {
  const lines = [
    `Hello ${String(record.name ?? '').split(' ')[0] || 'there'},`,
    '',
    // `projectType` is validated on the way in, but this function is exported and
    // could be handed a record from anywhere: a missing field must not reach a
    // customer as the word "undefined".
    `Thank you for ${record.projectType ? `your ${record.projectType} enquiry` : 'your enquiry'}. Your reference is ${record.reference} — quote it if you call us.`,
    '',
    'What happens next:',
    `  • It has gone to the ${routing?.routedTo ?? 'colour desk'}.`,
    `  • Someone will reply within ${routing?.slaHours ?? 24} hours of our next working day.`,
    '  • Urgent? Call 0902 642 4350 and give the reference above.',
    record.colors?.length ? `\nColours you asked about: ${record.colors.join(', ')}.` : null,
    record.quantities?.length
      ? `\nQuantities you measured: ${record.quantities
          .map((item) => `${item.label} — ${item.amount} ${item.unit}`)
          .join('; ')}.`
      : null,
    record.message ? `\nYou wrote: "${record.message.slice(0, 400)}${record.message.length > 400 ? '…' : ''}"` : null,
    '',
    'Those quantities are an estimate from our own coverage rates, not a quotation. Prices are not published; the desk',
    'will confirm what the job costs once it knows the surface and the condition of the walls.',
    '',
    'Your data: we keep this enquiry only as long as we need it to answer you and to honour any guarantee. To see,',
    'correct or delete what we hold, reply to this message or write to hello@opudapaint.com — we answer within 30 days.',
    '',
    'This is a one-off acknowledgement, not a newsletter. Nothing else will be sent to this address unless you ask.',
    '',
    "OPUDA'S PAINT · Manufactured in Port Harcourt · opudapaint.com",
  ]
  return lines.filter((line) => line !== null).join('\n')
}

/**
 * Send the visitor their own reference back. Never rejects, and runs after the
 * response has gone out, so it cannot make a successful enquiry feel slow.
 */
export async function notifyCustomer(record, routing, { dataDir } = {}) {
  const current = config()
  if (!acknowledgementEnabled(current)) return { sent: false, reason: 'disabled' }
  if (!record.email) {
    // No address to reply to is not a failure: plenty of enquiries are phone-only.
    return { sent: false, reason: 'no-address' }
  }

  const outcome = await withRetries('acknowledgement', () =>
    postOnce(current.resendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.resendKey}` },
      body: JSON.stringify({
        from: current.emailFrom,
        to: [record.email],
        subject: `Your OPUDA'S PAINT enquiry ${record.reference}`,
        text: acknowledgementText(record, routing),
      }),
    }),
  )
  recordOutcome('acknowledgement', outcome)
  log[outcome.ok ? 'info' : 'error']('notify.acknowledgement', {
    reference: record.reference,
    ok: outcome.ok,
    ...(outcome.ok ? {} : { error: outcome.error }),
  })

  // The audit line says a message went to a customer, and whether it arrived.
  // The address itself already lives on the enquiry record; it does not need a
  // second copy in a second file.
  if (dataDir) {
    try {
      await appendFile(
        join(dataDir, 'notifications.jsonl'),
        `${JSON.stringify({
          at: new Date().toISOString(),
          reference: record.reference,
          kind: 'acknowledgement',
          results: [{ channel: 'acknowledgement', ok: outcome.ok, ...(outcome.ok ? {} : { error: outcome.error }) }],
        })}\n`,
        'utf8',
      )
    } catch (error) {
      log.error('notify.audit_failed', { reference: record.reference, error: String(error) })
    }
  }

  return { sent: outcome.ok, ...(outcome.ok ? {} : { reason: 'delivery-failed' }) }
}

/* ------------------------------------------------- data-subject requests */

/**
 * Tell the desk that a customer has exercised a right.
 *
 * Roadmap 16.03.07 and NDPA sections 30–36: a request to see, correct or delete
 * personal data has a statutory clock on it, so it is announced the same way an
 * enquiry is, and its delivery is audited the same way.
 */
export async function notifyPrivacyRequest(record, { dataDir } = {}) {
  const current = config()
  const text = [
    `Data-subject request — ${record.reference}`,
    '',
    `Right exercised: ${record.type}`,
    record.enquiryReference ? `About enquiry: ${record.enquiryReference}` : null,
    `Reply to: ${record.email}`,
    '',
    record.note ? `"${record.note.slice(0, 500)}"` : null,
    '',
    'The clock on this one is statutory, not commercial: answer within 30 days.',
  ]
    .filter((line) => line !== null)
    .join('\n')

  const senders = []
  if (current.webhook) {
    senders.push([
      'webhook',
      () =>
        postOnce(current.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, record, kind: 'privacy-request', source: "OPUDA'S PAINT website" }),
        }),
    ])
  }
  if (current.resendKey && current.emailTo.length && current.emailFrom) {
    senders.push([
      'email',
      () =>
        postOnce(current.resendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.resendKey}` },
          body: JSON.stringify({
            from: current.emailFrom,
            to: current.emailTo,
            subject: `Data-subject request ${record.reference} — ${record.type}`,
            text,
            reply_to: record.email,
          }),
        }),
    ])
  }

  if (!senders.length) {
    log.warn('notify.skipped', { reference: record.reference, kind: 'privacy-request', reason: 'no channels configured' })
    return { configured: false, results: [] }
  }

  const results = await Promise.all(
    senders.map(async ([channel, send]) => {
      const outcome = await withRetries(channel, send)
      recordOutcome(channel, outcome)
      log[outcome.ok ? 'info' : 'error']('notify.privacy_request', {
        reference: record.reference,
        channel,
        ok: outcome.ok,
        ...(outcome.ok ? {} : { error: outcome.error }),
      })
      return { channel, ...outcome }
    }),
  )

  if (dataDir) {
    try {
      await appendFile(
        join(dataDir, 'notifications.jsonl'),
        `${JSON.stringify({
          at: new Date().toISOString(),
          reference: record.reference,
          kind: 'privacy-request',
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
      recordOutcome(channel, outcome)
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
