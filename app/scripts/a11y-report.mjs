/**
 * Turn `reports/a11y.json` into a pull-request comment.
 *
 * CI job logs are the wrong place for an audit result: nobody reads a green
 * tick, and a red cross with no explanation costs more time than the audit
 * saves. This prints the failures — with the rule, the selector and the count —
 * and stays quiet about the passes beyond a single line.
 *
 *   node scripts/a11y-report.mjs reports/a11y.json
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'reports/a11y.json'

let report
try {
  report = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  process.stdout.write(`The accessibility audit produced no report (${file}).\n\n${String(error)}\n`)
  process.exit(0)
}

const results = Array.isArray(report.results) ? report.results : []
const failed = results.filter((result) => !result.ok)
const passed = results.length - failed.length

const lines = []
lines.push('### Accessibility audit')
lines.push('')
lines.push(`${passed} of ${results.length} checks passed against \`${report.base ?? 'the build'}\`.`)
lines.push('')

if (!failed.length) {
  lines.push('No failures.')
} else {
  lines.push('| Check | What it found |')
  lines.push('| --- | --- |')
  for (const result of failed) {
    const detail = String(result.detail ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\n/g, '<br>')
      .slice(0, 900)
    lines.push(`| ${result.name.replace(/\|/g, '\\|')} | ${detail || '—'} |`)
  }
  lines.push('')
  lines.push(
    'Rules are WCAG 2.2 level A and AA. The keyboard, focus, reduced-motion and ' +
      '360px checks are this project\'s own; the rest come from axe-core.',
  )
}

process.stdout.write(`${lines.join('\n')}\n`)
