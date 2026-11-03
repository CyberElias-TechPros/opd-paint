/**
 * Durable rate limiting and short-lived memos.
 *
 * The limiter used to be a `Map` in this process. That is fine until the moment
 * it is not: a restart clears every bucket, so a deploy is a free pass for
 * whoever is being limited, and a second instance means two independent
 * allowances — twice the abuse, and no way to see it. Roadmap 17.01.08 asks for
 * rate limiting and abuse detection; 17.03 and `docs/remaining-work.md` both
 * named the shared store as the missing piece.
 *
 * The store is an **append-only JSON Lines file**, which buys three things a
 * `Map` cannot:
 *
 *  1. **It survives a restart**, because a hit is written the moment it happens.
 *  2. **It is shared by every instance that mounts the volume.** Appends with
 *     `O_APPEND` are atomic for a line this small, so two processes cannot tear
 *     each other's writes, and each one re-reads when the file's mtime or size
 *     changes — the same trick the colour index uses.
 *  3. **It needs no dependency.** No Redis client, no connection pool, no
 *     service to keep alive. That matters in a project whose whole backend is
 *     one file on purpose.
 *
 * Honest limits, because this is a limiter and not a ledger:
 *
 *  • Counting is accurate as of the last read, so a hit from another instance
 *    can be seen a few milliseconds late. For 12 enquiries per 10 minutes that
 *    is immaterial; for a stock exchange it would not be.
 *  • Pruning rewrites the file, and a line appended by another instance between
 *    the read and the rename can be dropped. Only lines *older than the window*
 *    are pruned, and pruning is throttled, so the worst case is one uncounted
 *    request — never a lost enquiry. Those live in `quotes.jsonl`.
 *  • A shared file is the right answer for one host or a shared volume. Two
 *    hosts on two disks need a real shared store, and `OPD_RATE_STORE=redis`
 *    should then be written; there is deliberately no half-built version of it
 *    here.
 *
 * Set `OPD_RATE_STORE=memory` to opt out — a development machine, or a test
 * that wants buckets to start empty every time.
 */
import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { log } from './logger.mjs'

/** Every public limit in the service is a 10-minute window. */
export const DEFAULT_WINDOW_MS = 10 * 60 * 1000

/** Above this many lines the file is pruned even if the throttle says wait. */
const PRUNE_ABOVE_LINES = 4000

/**
 * @param {object} options
 * @param {string} [options.file] Absolute path to the JSONL store. Empty or
 *   omitted keeps everything in memory.
 * @param {number} [options.windowMs] Longest window any caller uses; lines
 *   older than this are prunable.
 * @param {number} [options.pruneEveryMs] How often a prune may rewrite the file.
 */
export function createLimitStore({ file = '', windowMs = DEFAULT_WINDOW_MS, pruneEveryMs = 60_000 } = {}) {
  /** @type {Array<{ at: number, key: string, value?: string }>} */
  let lines = []
  /** `${mtimeMs}:${size}` of the read that produced `lines`. */
  let cacheKey = ''
  let lastPrune = 0
  let memoryOnly = !file

  /* ------------------------------------------------------------------ read */

  /** Re-read the file only when somebody has written to it since last time. */
  async function refresh() {
    if (memoryOnly) return
    let info
    try {
      info = await stat(file)
    } catch {
      // No file yet is an empty store, not an error.
      if (lines.length) {
        lines = []
        cacheKey = ''
      }
      return
    }
    const key = `${info.mtimeMs}:${info.size}`
    if (key === cacheKey) return
    try {
      const raw = await readFile(file, 'utf8')
      const parsed = []
      let damaged = 0
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          if (typeof entry?.at !== 'number' || typeof entry?.key !== 'string') {
            damaged += 1
            continue
          }
          if (entry.forget === true) {
            // A tombstone. An append-only file cannot delete a line, so it marks
            // one: everything recorded against this key before this point is
            // cancelled. The mark itself is consumed here, which is also why
            // `prune` can rewrite the file without carrying tombstones forward.
            for (let index = parsed.length - 1; index >= 0; index -= 1) {
              if (parsed[index].key === entry.key) parsed.splice(index, 1)
            }
            continue
          }
          parsed.push(entry)
        } catch {
          damaged += 1
        }
      }
      lines = parsed
      cacheKey = key
      if (damaged) {
        // Tolerated, never silent: a limiter that quietly forgets is how an
        // abuse pattern survives a disk fault.
        log.warn('limits.damaged_lines', { damaged, file: file.split('/').pop() })
      }
    } catch (error) {
      log.error('limits.read_failed', { message: String(error?.message ?? error) })
    }
  }

  /* ----------------------------------------------------------------- write */

  async function append(entry) {
    if (memoryOnly) {
      lines.push(entry)
      return true
    }
    try {
      await mkdir(dirname(file), { recursive: true })
      await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8')
      lines.push(entry)
      // Record what the file now looks like, so the next `refresh` is a `stat`
      // rather than a re-read: our own write is already in `lines`.
      const info = await stat(file)
      cacheKey = `${info.mtimeMs}:${info.size}`
      return true
    } catch (error) {
      // A limiter that cannot write must still limit. Falling back to memory
      // keeps the protection and says out loud that it is now per-process.
      log.error('limits.write_failed', { message: String(error?.message ?? error), fallback: 'memory' })
      memoryOnly = true
      lines.push(entry)
      return false
    }
  }

  /**
   * Drop every line older than the longest window. Rewrites atomically, so a
   * reader never sees a half-written file.
   */
  async function prune({ force = false } = {}) {
    if (memoryOnly) {
      const cutoff = Date.now() - windowMs
      lines = lines.filter((entry) => entry.at > cutoff)
      return 0
    }
    const now = Date.now()
    if (!force && now - lastPrune < pruneEveryMs && lines.length < PRUNE_ABOVE_LINES) return 0
    await refresh()
    const cutoff = now - windowMs
    const keep = lines.filter((entry) => entry.at > cutoff)
    if (keep.length === lines.length) {
      lastPrune = now
      return 0
    }
    try {
      const temporary = `${file}.${process.pid}.tmp`
      await writeFile(temporary, keep.map((entry) => JSON.stringify(entry)).join('\n') + (keep.length ? '\n' : ''), 'utf8')
      await rename(temporary, file)
      lines = keep
      cacheKey = ''
      lastPrune = now
      return lines.length
    } catch (error) {
      log.error('limits.prune_failed', { message: String(error?.message ?? error) })
      lastPrune = now
      return 0
    }
  }

  /* ------------------------------------------------------------------- API */

  /**
   * Count one hit against `key` and say whether it crosses `limit`.
   *
   * The hit is recorded whether or not it is allowed — that is what makes the
   * count mean "attempts", and why a client hammering a 429 stays limited.
   *
   * @returns {Promise<{ limited: boolean, count: number, remaining: number, resetMs: number }>}
   */
  async function hit(key, limit = 12, window = windowMs) {
    const now = Date.now()
    // Read first, so hits another instance wrote a moment ago are counted; then
    // write ours. The order is what makes a shared file behave like a shared
    // bucket rather than one per process.
    await refresh()
    await append({ at: now, key })
    const from = now - window
    const hits = lines.filter((entry) => entry.key === key && entry.at > from)
    const oldest = hits.reduce((min, entry) => Math.min(min, entry.at), now)
    const count = hits.length
    return {
      limited: count > limit,
      count,
      remaining: Math.max(0, limit - count),
      resetMs: Math.max(0, oldest + window - now),
    }
  }

  /**
   * Cancel everything recorded against `key`.
   *
   * For the attempt budgets that are meant to be earned back: a successful second
   * factor clears the counter that existed to stop somebody guessing codes.
   * Writes a tombstone rather than rewriting the file, so a concurrent reader in
   * another process still sees a valid append-only log.
   */
  async function forget(key) {
    lines = lines.filter((entry) => entry.key !== key)
    if (!file || memoryOnly) return true
    try {
      await mkdir(dirname(file), { recursive: true })
      await appendFile(file, `${JSON.stringify({ at: Date.now(), key, forget: true })}\n`, 'utf8')
      const info = await stat(file)
      cacheKey = `${info.mtimeMs}:${info.size}`
      return true
    } catch (error) {
      log.error('limits.forget_failed', { message: String(error?.message ?? error) })
      return false
    }
  }

  /**
   * Store a value against a key for `ttlMs`.
   *
   * Used for duplicate suppression (14.01.05): the same enquiry submitted twice
   * in a minute — a double click, a retry after a flaky connection — should come
   * back with the reference the visitor already has, not a second record for the
   * desk to untangle.
   */
  async function remember(key, value, ttlMs = windowMs) {
    await append({ at: Date.now(), key, value: String(value) })
    await prune()
    return value
  }

  /**
   * The most recent value stored against `key` that has not expired.
   *
   * "Most recent" is file order, not the timestamp: two writes inside the same
   * millisecond have the same `at`, and an append-only file already knows which
   * of them came second. Comparing with `>=` is what makes that true instead of
   * leaving the winner to whichever line the loop happened to reach first.
   */
  async function recall(key, ttlMs = windowMs) {
    await refresh()
    const from = Date.now() - ttlMs
    let found = null
    for (const entry of lines) {
      if (entry.key !== key || entry.value === undefined || entry.at <= from) continue
      if (!found || entry.at >= found.at) found = entry
    }
    return found?.value ?? null
  }

  /** How many lines the store is holding — reported by `/api/health`. */
  async function size() {
    await refresh()
    return lines.length
  }

  /** Whether hits are durable (`file`) or per-process (`memory`). */
  const kind = () => (memoryOnly ? 'memory' : 'file')

  /** Load what a previous process wrote. Called once at startup. */
  async function open() {
    await refresh()
    if (!memoryOnly && lines.length) {
      log.info('limits.store_loaded', { lines: lines.length, file: file.split('/').pop() })
    }
    return { lines: lines.length, kind: kind() }
  }

  return { open, hit, remember, recall, forget, prune, size, kind }
}
