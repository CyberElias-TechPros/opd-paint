#!/usr/bin/env node
/**
 * Turn Lighthouse CI's assertion results into a pull-request comment.
 *
 * The budget is only useful if a failure says *which* number was missed, on
 * which page, and by how much. "Lighthouse budgets failed" after four minutes
 * of collection is not that.
 *
 *   node tools/lighthouse-report.mjs "$ASSERTION_RESULTS_JSON"
 */
const raw = process.argv[2] ?? ''

let assertions
try {
  assertions = JSON.parse(raw)
} catch {
  assertions = null
}

if (!Array.isArray(assertions)) {
  process.stdout.write(
    '### Lighthouse budgets\n\nNo assertion results were produced, which means the run itself failed ' +
      '(build, server or collection) rather than a budget being exceeded.\n',
  )
  process.exit(0)
}

// `level` is the severity of the assertion, not its outcome: an error-level
// budget that was met must not appear here.
const failed = assertions.filter((entry) => entry.passed === false)

const rows = (list) =>
  list
    .map((entry) => {
      const page = String(entry.url ?? '')
        .replace(/^https?:\/\/[^/]+/, '')
        .replace(/\/$/, '') || '/'
      const expected = entry.expected === undefined ? '—' : JSON.stringify(entry.expected)
      const actual = entry.actual === undefined ? '—' : JSON.stringify(entry.actual)
      return `| \`${page}\` | ${entry.name ?? entry.auditId} | ${expected} | ${actual} | ${entry.level ?? 'error'} |`
    })
    .join('\n')

const lines = ['### Lighthouse budgets', '']

if (!failed.length) {
  lines.push(`All ${assertions.length} assertions passed.`)
} else {
  lines.push(`${failed.length} of ${assertions.length} assertions failed.`)
  lines.push('')
  lines.push('| Page | Budget | Expected | Actual | Severity |')
  lines.push('| --- | --- | --- | --- | --- |')
  lines.push(rows(failed.slice(0, 40)))
  if (failed.length > 40) lines.push('', `…and ${failed.length - 40} more.`)
  lines.push('')
  lines.push(
    'Budgets live in `.lighthouserc.json`. Thresholds are deliberate: if one is ' +
      'unreachable on this hardware, the fix is to argue for the number and change ' +
      'it, not to delete it.',
  )
}

process.stdout.write(`${lines.join('\n')}\n`)
