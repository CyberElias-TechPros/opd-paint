#!/usr/bin/env node
/**
 * Summarise Lighthouse reports: what missed a budget, and *what moved*.
 *
 * A failing CLS budget that says "0.147" is a number, not a diagnosis. The
 * Lighthouse report already contains the answer — `layout-shift-elements` lists
 * the nodes that moved, with selectors and the score they contributed — so this
 * prints it. The same goes for LCP's element and the main-thread work that made
 * TBT high.
 *
 *   node tools/lighthouse-report.mjs lighthouse-reports
 *
 * Prints markdown, ready for a pull-request comment or a step summary.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'lighthouse-reports'

const BUDGETS = {
  'largest-contentful-paint': 2500,
  'cumulative-layout-shift': 0.1,
  'total-blocking-time': 300,
  'first-contentful-paint': 1800,
}

if (!existsSync(dir)) {
  console.log('### Lighthouse\n\nNo reports were produced, so the run failed before collecting.\n')
  process.exit(0)
}

const files = readdirSync(dir).filter((file) => file.endsWith('.report.json'))

if (!files.length) {
  console.log(`### Lighthouse\n\nNo report files in \`${dir}\`.\n`)
  process.exit(0)
}

const lines = ['### Lighthouse', '']
const problems = []

for (const file of files) {
  const report = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  const url = new URL(report.finalDisplayedUrl ?? report.finalUrl ?? report.requestedUrl ?? 'http://localhost/')
  const path = url.pathname + url.search
  const scores = report.categories ?? {}
  const audits = report.audits ?? {}

  const score = (id) => {
    const value = scores[id]?.score
    return typeof value === 'number' ? Math.round(value * 100) : '—'
  }

  lines.push(`#### \`${path}\``)
  lines.push('')
  lines.push(
    `performance **${score('performance')}** · accessibility **${score('accessibility')}** · ` +
      `best-practices **${score('best-practices')}** · SEO **${score('seo')}**`,
  )
  lines.push('')

  const metrics = ['first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time']
  const rows = metrics
    .map((id) => {
      const audit = audits[id]
      if (!audit) return null
      const numeric = audit.numericValue ?? 0
      const budget = BUDGETS[id]
      const failed = budget !== undefined && numeric > budget
      const shown = id === 'cumulative-layout-shift' ? numeric.toFixed(3) : `${Math.round(numeric)} ms`
      return { id, shown, budget, failed, display: audit.displayValue ?? shown }
    })
    .filter(Boolean)

  lines.push('| Metric | Value | Budget | |')
  lines.push('| --- | --- | --- | --- |')
  for (const row of rows) {
    const budget = row.id === 'cumulative-layout-shift' ? row.budget : `${row.budget} ms`
    lines.push(`| ${row.id} | ${row.display} | ${budget} | ${row.failed ? '❌' : '✅'} |`)
    if (row.failed) problems.push(`${path}: ${row.id} ${row.display}`)
  }
  lines.push('')

  // What moved — the only thing that makes a CLS failure fixable. Lighthouse has
  // moved this detail between audits over versions, so look in both places.
  const collectNodes = (audit) =>
    (audit?.details?.items ?? []).flatMap((item) => [
      ...(item.node ? [item] : []),
      ...(item.subItems?.items ?? []).filter((sub) => sub.node),
    ])

  const shiftItems = [...collectNodes(audits['layout-shift-elements']), ...collectNodes(audits['layout-shifts'])]
  if (shiftItems.length) {
    lines.push('Elements that moved:')
    lines.push('')
    for (const item of shiftItems.slice(0, 8)) {
      const node = item.node ?? {}
      const selector = node.selector ?? node.snippet ?? '(unknown)'
      const contribution = typeof item.score === 'number' ? ` · ${item.score.toFixed(3)}` : ''
      lines.push(`- \`${selector.slice(0, 140)}\`${contribution}`)
    }
    lines.push('')
  } else if ((audits['cumulative-layout-shift']?.numericValue ?? 0) > 0.05) {
    // Say so rather than silently omitting the section — the next person needs
    // to know the diagnosis is missing, not that nothing moved.
    const layoutAudits = Object.keys(audits).filter((id) => id.includes('layout'))
    lines.push(`_(No element-level detail in this report. Layout audits present: ${layoutAudits.join(', ') || 'none'}.)_`)
    lines.push('')
  }

  const lcpItem = audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node
  if (lcpItem?.selector) {
    lines.push(`LCP element: \`${String(lcpItem.selector).slice(0, 140)}\``)
    lines.push('')
  }

  const failing = Object.values(audits)
    .filter((audit) => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode === 'binary' && audit.score !== undefined)
    .map((audit) => audit.id)

  if (failing.length) {
    lines.push(`Failed audits: ${[...new Set(failing)].slice(0, 12).join(', ')}`)
    lines.push('')
  }
}

if (problems.length) {
  lines.push(`**${problems.length} budget(s) missed:** ${problems.join('; ')}`)
} else {
  lines.push('All measured budgets are met.')
}

console.log(`${lines.join('\n')}\n`)
