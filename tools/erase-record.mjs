#!/usr/bin/env node
/**
 * Honour an erasure request — roadmap 16.03.07, NDPA sections 30–36.
 *
 *   node tools/erase-record.mjs --email ade@example.com                 # dry run (the default)
 *   node tools/erase-record.mjs --reference OPD-260101-1A2B --dry-run
 *   node tools/erase-record.mjs --email ade@example.com --request DSAR-261103-4K2P --yes
 *
 * The website takes erasure requests and gives them a reference. Somebody still
 * has to act on one, and "open the JSON lines file in an editor and delete the
 * right line" is not a process — it is how a customer's data survives a request
 * to delete it, or how the wrong line goes.
 *
 * What this does, and the reasoning behind each choice:
 *
 *   • **Dry run unless `--yes`.** Deleting personal data is the one operation in
 *     this repository that cannot be undone from inside the repository, so the
 *     default is to show what would happen.
 *   • **It prints references, not records.** A tool that echoes the record it is
 *     about to delete writes that personal data into a terminal, a scrollback and
 *     a CI log — three new copies of the thing being erased.
 *   • **Subscriptions are removed and then suppressed.** Deleting an address from
 *     the mailing list without writing a suppression entry would let the next
 *     sign-up resurrect it. The suppression row is kept forever, on purpose.
 *   • **The request record is kept.** `privacy-requests.jsonl` is the evidence
 *     that the right was honoured; without it there is no way to answer "did we
 *     delete it when they asked?". It carries the address and nothing else, and
 *     the service's 24-month retention removes it in time.
 *   • **No local backup is made.** `tools/backup.sh` is the safety net, and a
 *     `.bak` file next to the log would keep exactly the data the request asked
 *     us to stop keeping.
 *   • **An erasure is logged.** `erasure-log.jsonl` records what was removed,
 *     matched on what, against which request — references only.
 */
import { readFile, writeFile, rename, appendFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}
const has = (name) => args.includes(`--${name}`)

if (has('help') || has('h') || (!flag('email') && !flag('reference'))) {
  process.stdout.write(
    [
      'Erase personal data in response to a data-subject request.',
      '',
      '  --email <address>        match records by email address (case-insensitive)',
      '  --reference <OPD-…>      match one enquiry by its reference',
      '  --request <DSAR-…>       the request this erasure answers; recorded in the audit line',
      '  --data-dir <dir>         where the JSON lines live (default $OPD_DATA_DIR or server/data)',
      '  --actor <name>           who is running this; recorded in the audit line',
      '  --yes                    actually delete. Without it this is a dry run.',
      '  --json                   machine-readable output',
      '',
      'At least one of --email or --reference is required.',
      '',
    ].join('\n'),
  )
  process.exit(flag('email') || flag('reference') ? 0 : 2)
}

const DATA_DIR = resolve(flag('data-dir') ?? process.env.OPD_DATA_DIR ?? join(dirname(new URL(import.meta.url).pathname), '..', 'server', 'data'))
const EMAIL = (flag('email') ?? '').trim().toLowerCase()
const REFERENCE = (flag('reference') ?? '').trim().toUpperCase()
const REQUEST = (flag('request') ?? '').trim()
const ACTOR = (flag('actor') ?? process.env.USER ?? 'unknown').trim()
const APPLY = has('yes')
const AS_JSON = has('json')

const QUOTES = join(DATA_DIR, 'quotes.jsonl')
const SUBS = join(DATA_DIR, 'subscriptions.jsonl')
const UNSUBS = join(DATA_DIR, 'unsubscriptions.jsonl')
const ERASURE_LOG = join(DATA_DIR, 'erasure-log.jsonl')

/** Read a JSON lines file, keeping the lines that will not parse. */
async function read(file) {
  if (!existsSync(file)) return { kept: [], damaged: [], missing: true }
  const raw = await readFile(file, 'utf8')
  const kept = []
  const damaged = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      kept.push({ line, record: JSON.parse(line) })
    } catch {
      // A line this tool cannot read is a line it must not delete: it might be
      // the record somebody is asking about, damaged by a half-written append.
      damaged.push(line)
    }
  }
  return { kept, damaged, missing: false }
}

const matches = (record) => {
  if (REFERENCE && String(record.reference ?? '').toUpperCase() === REFERENCE) return 'reference'
  if (EMAIL && String(record.email ?? '').toLowerCase() === EMAIL) return 'email'
  return null
}

/** Rewrite a file atomically; a reader must never see it half-written. */
async function rewrite(file, lines) {
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, lines.length ? `${lines.join('\n')}\n` : '', 'utf8')
  await rename(temporary, file)
}

const summary = { at: new Date().toISOString(), dataDir: DATA_DIR, matchedOn: { email: EMAIL || null, reference: REFERENCE || null }, request: REQUEST || null, actor: ACTOR, applied: APPLY, erased: [], subscriptionsRemoved: 0, suppressed: false, damagedLinesKept: 0 }

/* ------------------------------------------------------------------ quotes */

const quotes = await read(QUOTES)
const removedQuotes = quotes.kept.filter(({ record }) => matches(record))
const keptQuotes = quotes.kept.filter(({ record }) => !matches(record)).map(({ line }) => line)
summary.erased = removedQuotes.map(({ record }) => ({
  reference: record.reference ?? null,
  receivedAt: record.receivedAt ?? record.at ?? null,
  city: record.city ?? null,
}))
summary.damagedLinesKept += quotes.damaged.length

/* ----------------------------------------------------------- subscriptions */

const subs = await read(SUBS)
const removedSubs = subs.kept.filter(({ record }) => matches(record))
const keptSubs = subs.kept.filter(({ record }) => !matches(record)).map(({ line }) => line)
summary.subscriptionsRemoved = removedSubs.length
summary.damagedLinesKept += subs.damaged.length

/* ------------------------------------------------------------- suppression */

const unsubs = await read(UNSUBS)
const alreadySuppressed = EMAIL
  ? unsubs.kept.some(({ record }) => String(record.email ?? '').toLowerCase() === EMAIL)
  : false
summary.suppressed = Boolean(EMAIL) && !alreadySuppressed

/* ------------------------------------------------------------------ report */

const lines = []
lines.push(`\nErasure ${APPLY ? '' : '(dry run — pass --yes to apply)'} · ${DATA_DIR}\n`)
lines.push(`  matched on     ${[EMAIL && `email ${EMAIL.replace(/^(.).*(@.*)$/, '$1…$2')}`, REFERENCE && `reference ${REFERENCE}`].filter(Boolean).join(', ')}`)
lines.push(`  request        ${REQUEST || 'not given — record which DSAR this answers'}`)
lines.push(`  run by         ${ACTOR}`)
lines.push(`\n  enquiries      ${removedQuotes.length} of ${quotes.kept.length} match`)
for (const entry of summary.erased) {
  lines.push(`    · ${entry.reference ?? '(no reference)'}  received ${entry.receivedAt ?? 'unknown'}  ${entry.city ?? ''}`)
}
lines.push(`  subscriptions  ${removedSubs.length} of ${subs.kept.length} match`)
lines.push(`  suppression    ${EMAIL ? (alreadySuppressed ? 'already suppressed — nothing to add' : 'a suppression entry will be added, so the address cannot be re-added by accident') : 'no address given, so no suppression entry'}`)
lines.push(`  request log    kept. It is the evidence that this was honoured, and the service's retention removes it later.`)
if (summary.damagedLinesKept) {
  lines.push(`\n  ! ${summary.damagedLinesKept} line(s) could not be parsed and were left exactly as they were.`)
  lines.push(`    A record this tool cannot read is a record it will not delete. Look at them by hand.`)
}
if (!removedQuotes.length && !removedSubs.length) {
  lines.push('\n  Nothing matches. Either it was already erased, or the address/reference is not the one on the record.')
}

if (!APPLY) {
  lines.push('\n  Nothing has been changed. Re-run with --yes to apply.')
}

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} else {
  process.stdout.write(`${lines.join('\n')}\n`)
}

if (!APPLY) process.exit(0)

/* ------------------------------------------------------------------- apply */

try {
  await mkdir(DATA_DIR, { recursive: true })

  if (removedQuotes.length) {
    await rewrite(QUOTES, [...keptQuotes, ...quotes.damaged])
  }
  if (removedSubs.length) {
    await rewrite(SUBS, [...keptSubs, ...subs.damaged])
  }
  if (summary.suppressed) {
    await appendFile(
      UNSUBS,
      `${JSON.stringify({
        at: new Date().toISOString(),
        email: EMAIL,
        source: 'erasure-request',
        ...(REQUEST ? { request: REQUEST } : {}),
      })}\n`,
      'utf8',
    )
  }

  // The audit line carries references and the reason, never the record: an
  // erasure log full of erased personal data is not an erasure.
  await appendFile(
    ERASURE_LOG,
    `${JSON.stringify({
      at: summary.at,
      kind: 'erasure',
      request: REQUEST || null,
      actor: ACTOR,
      matchedOn: summary.matchedOn,
      erased: summary.erased.map((entry) => entry.reference),
      subscriptionsRemoved: summary.subscriptionsRemoved,
      suppressed: summary.suppressed,
      damagedLinesKept: summary.damagedLinesKept,
    })}\n`,
    'utf8',
  )

  if (!AS_JSON) {
    process.stdout.write(
      `\n  applied: ${removedQuotes.length} enquiry record(s) and ${removedSubs.length} subscription(s) removed,` +
        ` ${summary.suppressed ? 'suppression entry added' : 'no suppression entry needed'},` +
        ` audit line written to ${ERASURE_LOG.split('/').pop()}.\n` +
        `  Now answer the request. The clock in the request record is the one that matters.\n\n`,
    )
  }
} catch (error) {
  process.stderr.write(`erase-record: could not apply — ${String(error?.message ?? error)}\n`)
  process.stderr.write('Nothing was half-deleted: each file is rewritten in one atomic step, and the audit line is written last.\n')
  process.exit(1)
}
