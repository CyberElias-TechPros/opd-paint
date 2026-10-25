/**
 * Structured logging.
 *
 * A log line is an event, not a sentence. Every line here is one JSON object on
 * one line — greppable, countable and shippable to any log drain without a
 * parser. In development the same object is printed readably, because a
 * developer reading a terminal is a different audience from a log search.
 *
 * Two rules that matter more than the format:
 *
 *  1. **No personal data.** An enquiry log line carries the reference number,
 *     never the name, phone or message. Production logs get copied, pasted into
 *     chat, and retained for years; a phone number in a log line is a data
 *     protection problem waiting for an incident.
 *  2. **Never throw.** A logger that can break a request is worse than no
 *     logger. Everything is wrapped.
 */

const JSON_MODE = process.env.OPD_LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const threshold = LEVELS[process.env.OPD_LOG_LEVEL] ?? LEVELS.info

/** A stable identifier to correlate every line a single request produces. */
export function requestId() {
  return Math.random().toString(36).slice(2, 10)
}

function write(level, event, fields) {
  if (LEVELS[level] < threshold) return
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(fields && typeof fields === 'object' ? fields : {}),
  }
  try {
    if (JSON_MODE) {
      process.stdout.write(`${JSON.stringify(line)}\n`)
    } else {
      const { ts, level: _level, event: _event, ...rest } = line
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : ''
      process.stdout.write(`${ts.slice(11, 19)} ${level.toUpperCase().padEnd(5)} ${event}${extra}\n`)
    }
  } catch {
    // A closed stdout (a container being torn down) must not fail a request.
  }
}

export const log = {
  debug: (event, fields) => write('debug', event, fields),
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields),
}

/** Everything worth knowing about a thrown value, without leaking a body. */
export function describeError(error) {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack?.split('\n').slice(0, 8).join('\n') }
  }
  return { message: String(error) }
}
