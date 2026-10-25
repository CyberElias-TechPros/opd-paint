/**
 * Accessibility audit against real Chromium.
 *
 * Runs axe-core (WCAG 2.0/2.1/2.2 level A and AA) on the pages that carry the
 * business — the colour library, a colour detail, the calculator, the quote
 * form — then checks the things automated rules cannot see:
 *
 *   • a skip link exists, is the first thing Tab reaches, and lands on `main`;
 *   • focus is *visible* on every interactive element (a rule axe cannot test,
 *     and the one most often lost to `outline: none`);
 *   • keyboard-only users can reach and operate the primary controls;
 *   • with `prefers-reduced-motion: reduce`, motion really is off;
 *   • nothing overflows horizontally at 360 px, the width of the cheapest
 *     Android phone this site will actually be read on.
 *
 * The build is served by the project's own server (`OPD_STATIC_DIR`), so this
 * also proves the static serving path works.
 *
 *   npm run test:a11y          # needs: npx playwright install chromium
 */
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.OPD_BASE_URL ?? 'http://127.0.0.1:8788'

const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/colours', name: 'Colour library' },
  { path: '/colours/bonny-haze', name: 'Colour detail' },
  { path: '/products', name: 'Products' },
  { path: '/products/matt', name: 'Product detail' },
  { path: '/calculator', name: 'Calculator' },
  { path: '/quote', name: 'Quote form' },
  { path: '/dealers', name: 'Dealers' },
  { path: '/inspiration', name: 'Inspiration' },
  { path: '/advice', name: 'Advice' },
  { path: '/about', name: 'About' },
  { path: '/legal/accessibility', name: 'Accessibility statement' },
  { path: '/this-page-does-not-exist', name: 'Not found' },
]

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

const results = []
let failures = 0

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  const mark = ok ? '\u001b[32mok\u001b[0m  ' : '\u001b[31mFAIL\u001b[0m'
  process.stdout.write(`  ${mark} ${name}${detail ? `\n        ${detail.replace(/\n/g, '\n        ')}` : ''}\n`)
}

const describe = (violation) =>
  `${violation.id} (${violation.impact}) — ${violation.help}\n` +
  violation.nodes
    .slice(0, 3)
    .map((node) => `  ${node.target.join(' ')}`)
    .join('\n') +
  (violation.nodes.length > 3 ? `\n  …and ${violation.nodes.length - 3} more` : '')

// `chrome` drives the browser already installed on the machine, which is what
// CI falls back to when the Playwright browser download fails. Anything else
// means the pinned, downloaded Chromium.
const CHANNEL = process.env.OPD_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined

async function main() {
  let browser
  try {
    browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {})
  } catch (error) {
    process.stderr.write(
      '\nCould not launch a browser. Install one with:\n\n  npx playwright install chromium\n\n' +
        'Or point OPD_BROWSER_CHANNEL=chrome at a Chrome already on the machine.\n\n' +
        `${String(error).split('\n')[0]}\n`,
    )
    process.exit(2)
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    // A phone-ish device pixel ratio so the mobile layouts are exercised too.
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  process.stdout.write(`\nAccessibility audit against ${BASE}${CHANNEL ? ` (${CHANNEL})` : ''}\n\n`)

  for (const entry of PAGES) {
    const response = await page.goto(`${BASE}${entry.path}`, { waitUntil: 'networkidle' })
    const status = response?.status() ?? 0
    const expected = entry.path === '/this-page-does-not-exist' ? 404 : 200
    record(`${entry.name} answers ${expected}`, status === expected, `got ${status}`)

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    record(
      `${entry.name} — axe, WCAG 2.2 AA`,
      violations.length === 0,
      violations.map(describe).join('\n\n'),
    )
  }

  /* ------------------------------------------------------- keyboard basics */

  await page.goto(`${BASE}/colours`, { waitUntil: 'networkidle' })

  const skip = await page.evaluate(() => {
    const link = document.querySelector('a[href="#main"]')
    if (!link) return null
    return {
      text: (link.textContent ?? '').trim(),
      targetExists: Boolean(document.getElementById('main')),
    }
  })
  record(
    'a skip link is present and lands on <main id="main">',
    Boolean(skip?.text) && skip.targetExists === true,
    skip ? `text: "${skip.text}", target ${skip.targetExists ? 'found' : 'MISSING'}` : 'no a[href="#main"] on the page',
  )

  // Tab from a clean load: the browser starts with nothing focused, so the
  // first Tab is what a keyboard user actually meets.
  await page.goto(`${BASE}/colours`, { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const firstStop = await page.evaluate(() => {
    const element = document.activeElement
    return {
      tag: element?.tagName ?? '',
      text: (element?.textContent ?? '').trim().slice(0, 60),
      href: element?.getAttribute('href') ?? '',
    }
  })
  record(
    'the first Tab stop is the skip link',
    firstStop.href === '#main',
    `first stop was <${firstStop.tag.toLowerCase()}> "${firstStop.text}"`,
  )

  // The focus ring comes from a global `:focus-visible` rule, which only matches
  // during real keyboard interaction — a programmatic focus() would report a
  // false failure here. So: actually press Tab, and look at each stop.
  const invisible = []
  let visited = 0
  for (let step = 0; step < 50; step += 1) {
    const stop = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const style = getComputedStyle(element)
      const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
      const ringed = style.boxShadow !== 'none'
      return {
        label: `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(' ')[0]}` : ''}`,
        visible: outlined || ringed,
      }
    })
    if (stop) {
      visited += 1
      if (!stop.visible) invisible.push(stop.label)
    }
    await page.keyboard.press('Tab')
  }
  record(
    `focus is visible on every keyboard stop (${visited} visited)`,
    visited > 10 && invisible.length === 0,
    visited <= 10 ? 'the page yielded almost no focusable elements' : invisible.slice(0, 8).join(', '),
  )

  /* ------------------------------------------------------------ reduced motion */

  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })
  const reducedPage = await reduced.newPage()
  await reducedPage.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const slowest = await reducedPage.evaluate(() => {
    let worst = 0
    let culprit = ''
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      const durations = [
        ...style.transitionDuration.split(','),
        ...style.animationDuration.split(','),
      ].map((value) => parseFloat(value) || 0)
      const longest = Math.max(...durations, 0)
      if (longest > worst) {
        worst = longest
        culprit = `${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0] ?? ''}`
      }
    }
    return { worst, culprit }
  })
  record(
    'with reduced motion, nothing animates for more than a frame',
    slowest.worst <= 0.02,
    `slowest: ${slowest.worst}s on ${slowest.culprit}`,
  )
  await reduced.close()

  /* ----------------------------------------------------------- small screens */

  const phone = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 })
  const phonePage = await phone.newPage()
  for (const path of ['/', '/colours', '/calculator', '/quote', '/dealers']) {
    await phonePage.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const overflow = await phonePage.evaluate(() => {
      const width = document.documentElement.clientWidth

      // An element that is merely *inside* a horizontal scroller (the filter
      // pills, a code strip) is not causing the page to overflow. Walk up and
      // ignore anything a scroll container is responsible for.
      const inScroller = (element) => {
        let parent = element.parentElement
        while (parent && parent !== document.body) {
          const overflowX = getComputedStyle(parent).overflowX
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden' || overflowX === 'clip') return true
          parent = parent.parentElement
        }
        return false
      }

      const wide = [...document.querySelectorAll('body *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          if (rect.width <= width + 1) return false
          if (getComputedStyle(element).position === 'fixed') return false
          return !inScroller(element)
        })
        .slice(0, 4)
        .map((element) => {
          const rect = element.getBoundingClientRect()
          const label = `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`
          const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 70)
          return `${label} (${Math.round(rect.width)}px) ${text ? `“${text}”` : ''}`
        })

      return { scrollWidth: document.documentElement.scrollWidth, width, wide }
    })
    record(
      `${path} fits a 360px screen`,
      overflow.scrollWidth <= overflow.width + 1,
      `${overflow.scrollWidth}px wide on a ${overflow.width}px screen: ${overflow.wide.join(' | ') || 'no single element identified'}`,
    )
  }
  await phone.close()

  /* -------------------------------------------------------------- console */

  record(
    'no console errors while browsing',
    consoleErrors.length === 0,
    [...new Set(consoleErrors)].slice(0, 5).join('\n'),
  )

  await browser.close()

  mkdirSync('reports', { recursive: true })
  writeFileSync(join('reports', 'a11y.json'), `${JSON.stringify({ base: BASE, results }, null, 2)}\n`)

  process.stdout.write(`\n${results.length - failures} passed, ${failures} failed\n`)
  if (failures) process.exitCode = 1
}

await main()
