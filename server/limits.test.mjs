/**
 * Durable rate limiting — run with `npm test`.
 *
 * The buckets used to be a `Map`, and the two things that follow from that were
 * invisible in every test that existed: a restart cleared them, so a deploy was
 * a free pass for whoever was being limited, and a second instance kept its own
 * count, so two instances meant twice the allowance.
 *
 * These tests drive the store directly rather than through HTTP, because the
 * claim under test is about *state surviving a process* — which an HTTP test can
 * only show by accident, and only if it happens to restart the service.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLimitStore } from './limits.mjs'

const dir = mkdtempSync(join(tmpdir(), 'opd-limits-'))
const file = join(dir, 'limits.jsonl')

test('a limit survives the process that set it', async () => {
  const path = join(dir, 'restart.jsonl')
  const first = createLimitStore({ file: path })
  await first.open()
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await first.hit('ip:quotes', 3)).limited, false, `hit ${index + 1} is inside the limit`)
  }
  assert.equal((await first.hit('ip:quotes', 3)).limited, true, 'the fourth is over it')

  // A new store on the same file is what a deploy looks like.
  const second = createLimitStore({ file: path })
  const state = await second.open()
  assert.equal(state.kind, 'file')
  assert.equal((await second.hit('ip:quotes', 3)).limited, true, 'the count came back with the process')
})

test('two instances on one file share one allowance', async () => {
  const path = join(dir, 'shared.jsonl')
  const a = createLimitStore({ file: path })
  const b = createLimitStore({ file: path })
  await a.open()
  await b.open()

  assert.equal((await a.hit('ip:subscribe', 4)).limited, false)
  assert.equal((await b.hit('ip:subscribe', 4)).limited, false)
  assert.equal((await a.hit('ip:subscribe', 4)).limited, false)
  assert.equal((await b.hit('ip:subscribe', 4)).limited, false)
  // Five attempts across two processes, one limit of four.
  assert.equal((await a.hit('ip:subscribe', 4)).limited, true, 'the fifth is limited whichever instance counts it')
  assert.equal((await b.hit('ip:subscribe', 4)).limited, true, 'and the other instance agrees')
})

test('windows are per key, so a quoting session cannot lock out a subscription', async () => {
  const path = join(dir, 'scoped.jsonl')
  const store = createLimitStore({ file: path })
  await store.open()
  for (let index = 0; index < 12; index += 1) await store.hit('1.2.3.4:quotes', 12)
  assert.equal((await store.hit('1.2.3.4:quotes', 12)).limited, true)
  assert.equal((await store.hit('1.2.3.4:subscribe', 6)).limited, false, 'a different endpoint is a different bucket')
})

test('a window closes when it is old enough', async () => {
  const path = join(dir, 'window.jsonl')
  const store = createLimitStore({ file: path })
  await store.open()
  // Written by hand rather than waited out: a test that sleeps for ten minutes
  // is a test nobody runs.
  const old = Date.now() - 11 * 60 * 1000
  writeFileSync(path, `${JSON.stringify({ at: old, key: 'ip:errors' })}\n`.repeat(20), 'utf8')
  const outcome = await store.hit('ip:errors', 20)
  assert.equal(outcome.limited, false, 'twenty hits from eleven minutes ago are outside a ten-minute window')
  assert.equal(outcome.count, 1, 'only the new one is counted')
})

test('the count tells a caller how much is left and when it resets', async () => {
  const path = join(dir, 'remaining.jsonl')
  const store = createLimitStore({ file: path })
  await store.open()
  const outcome = await store.hit('ip:quotes', 12)
  assert.equal(outcome.count, 1)
  assert.equal(outcome.remaining, 11)
  assert.ok(outcome.resetMs > 0 && outcome.resetMs <= 10 * 60 * 1000, 'the reset is inside the window')
})

test('a damaged line is tolerated and counted, not trusted', async () => {
  const path = join(dir, 'damaged.jsonl')
  writeFileSync(path, `${JSON.stringify({ at: Date.now(), key: 'ip:quotes' })}\n{"at": truncated\nnot json at all\n`, 'utf8')
  const store = createLimitStore({ file: path })
  await store.open()
  const outcome = await store.hit('ip:quotes', 5)
  assert.equal(outcome.count, 2, 'the readable line still counts')
  assert.equal(outcome.limited, false, 'and the unreadable ones do not break the limiter')
})

test('a store that cannot write keeps limiting, in memory, and says so', async () => {
  // A directory sitting exactly where the file should be, so every append fails
  // with EISDIR. The alternative behaviour — refusing to limit because the disk
  // is unhappy — is worse than the one this chooses.
  const path = join(dir, 'limits.jsonl')
  const { mkdirSync } = await import('node:fs')
  mkdirSync(path, { recursive: true })
  const store = createLimitStore({ file: path })
  await store.open()
  assert.equal((await store.hit('ip:quotes', 1)).limited, false)
  assert.equal((await store.hit('ip:quotes', 1)).limited, true, 'the fallback still counts')
  assert.equal(store.kind(), 'memory', 'and /api/health now reports limits as per-process, not durable')
})

test('memory mode keeps no file at all', async () => {
  const store = createLimitStore({ file: '' })
  await store.open()
  assert.equal((await store.hit('ip:quotes', 1)).limited, false)
  assert.equal((await store.hit('ip:quotes', 1)).limited, true)
  assert.equal(store.kind(), 'memory')
})

describe('duplicate suppression memos', () => {
  test('a value comes back inside its window and not after it', async () => {
    const path = join(dir, 'memo.jsonl')
    const store = createLimitStore({ file: path })
    await store.open()
    await store.remember('dedupe:abc123', 'OPD-261103-4K2P', 60_000)
    assert.equal(await store.recall('dedupe:abc123', 60_000), 'OPD-261103-4K2P')
    assert.equal(await store.recall('dedupe:abc123', 0), null, 'an expired memo is gone')
    assert.equal(await store.recall('dedupe:something-else', 60_000), null, 'and one key is not another')
  })

  test('the newest value for a key wins', async () => {
    const path = join(dir, 'memo-newest.jsonl')
    const store = createLimitStore({ file: path })
    await store.open()
    await store.remember('dedupe:xyz', 'OPD-1', 60_000)
    await store.remember('dedupe:xyz', 'OPD-2', 60_000)
    assert.equal(await store.recall('dedupe:xyz', 60_000), 'OPD-2')
  })
})

test('forgetting a key clears its count, in this process and the next', async () => {
  const path = join(dir, 'forget.jsonl')
  const store = createLimitStore({ file: path })
  await store.open()
  for (let index = 0; index < 3; index += 1) await store.hit('ip:mfa', 3)
  assert.equal((await store.hit('ip:mfa', 3)).limited, true, 'the budget is spent')

  assert.equal(await store.forget('ip:mfa'), true)
  assert.equal((await store.hit('ip:mfa', 3)).limited, false, 'and earning it back works immediately')

  const reopened = createLimitStore({ file: path })
  await reopened.open()
  assert.equal((await reopened.hit('ip:mfa', 3)).limited, false, 'the tombstone survived the restart too')
  await store.hit('ip:other', 1)
  assert.equal((await store.hit('ip:other', 1)).limited, true, 'forgetting one key does not touch another')
})

test('pruning drops what is outside the window and keeps the rest', async () => {
  const path = join(dir, 'prune.jsonl')
  const old = Date.now() - 30 * 60 * 1000
  writeFileSync(
    path,
    [
      JSON.stringify({ at: old, key: 'ip:quotes' }),
      JSON.stringify({ at: Date.now(), key: 'ip:quotes' }),
      '',
    ].join('\n'),
    'utf8',
  )
  const store = createLimitStore({ file: path, pruneEveryMs: 0 })
  await store.open()
  await store.prune({ force: true })
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
  assert.equal(lines.length, 1, 'the line from thirty minutes ago is gone')
  assert.equal(JSON.parse(lines[0]).key, 'ip:quotes', 'and the fresh one survived')
})

test('a file that does not exist yet is an empty store, not an error', async () => {
  const store = createLimitStore({ file: join(dir, 'never-written.jsonl') })
  const state = await store.open()
  assert.equal(state.lines, 0)
  assert.equal((await store.hit('ip:quotes', 1)).limited, false)
})

test('the store cleans up after itself', () => {
  rmSync(dir, { recursive: true, force: true })
})
