/**
 * Browser-level interaction tests.
 *
 * The route smoke test renders to a string; it proves a page can be produced,
 * not that it can be *used*. This file covers the two places where a visitor
 * actually commits something — the quote form and the paint calculator — in a
 * real DOM, against the real enquiry service.
 *
 * Why a real DOM and a real server rather than mocks:
 *   • The bugs these tests are meant to catch live in the seams — a controlled
 *     input that never updates, a submit handler that reads `FormData` before
 *     React has written the value, a response shape the UI reads as undefined.
 *     A mocked `fetch` agrees with whatever the UI believes; the actual service
 *     does not.
 *   • jsdom runs here and in CI without downloading a browser. The heavier
 *     checks (axe, Lighthouse) run against real Chromium in their own jobs.
 *
 *   npm run test:browser
 */
import { JSDOM } from 'jsdom'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

/* ------------------------------------------------------------------ jsdom */

const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const { window } = dom

// jsdom is not a browser and does not implement these; the app only touches
// them incidentally, so a minimal stand-in keeps the test about the app.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }),
})
window.scrollTo = () => {}
class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
;(window as unknown as Record<string, unknown>).IntersectionObserver = Observer
;(window as unknown as Record<string, unknown>).ResizeObserver = Observer

const forwarded = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'Element',
  'Node',
  'KeyboardEvent',
  'MouseEvent',
  'InputEvent',
  'FormData',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const

// `globalThis.navigator` is a getter-only property in Node 22, so everything is
// installed with defineProperty rather than assignment.
//
// `Event`, `CustomEvent` and `Blob` are deliberately *not* replaced: Node's own
// fetch is built on the global `Event`, and shadowing it breaks undici before a
// single test runs. The helpers below dispatch jsdom's `window.Event` directly,
// which is what a real listener sees anyway.
for (const key of forwarded) {
  const value = (window as unknown as Record<string, unknown>)[key]
  const bound =
    typeof value === 'function' && key !== 'window' ? (value as (...args: unknown[]) => unknown).bind(window) : value
  Object.defineProperty(globalThis, key, { value: bound, configurable: true, writable: true })
}
;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

/* ----------------------------------------------------------------- server */

const dataDir = mkdtempSync(join(tmpdir(), 'opd-browser-'))
const PORT = 19000 + Math.floor(Math.random() * 900)
const SERVER_ENTRY = resolve(process.cwd(), '..', 'server', 'index.mjs')

let service: ChildProcess | undefined

async function startService(): Promise<void> {
  service = spawn(process.execPath, [SERVER_ENTRY], {
    env: { ...process.env, PORT: String(PORT), OPD_DATA_DIR: dataDir, OPD_LOG_LEVEL: 'error' },
    stdio: ['ignore', 'ignore', 'inherit'],
  })

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`)
      if (res.ok) return
    } catch {
      /* not listening yet */
    }
    await sleep(50)
  }
  throw new Error(`the enquiry service did not start on port ${PORT}`)
}

function stopService(): void {
  if (service && !service.killed) service.kill()
}

// Same-origin in production, so the app always asks for `/api/...`. Node's
// fetch needs an absolute URL, so that single translation lives here.
const realFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const absolute = url.startsWith('/api/') ? `http://127.0.0.1:${PORT}${url}` : url
  return realFetch(absolute as string, init)
}) as typeof fetch

/* ------------------------------------------------------------------ react */

type Mounted = {
  container: HTMLElement
  unmount: () => Promise<void>
  root: import('react-dom/client').Root
}

async function render(element: import('react').ReactElement): Promise<Mounted> {
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const container = document.getElementById('root') as HTMLElement
  container.innerHTML = ''
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await flush()
  return {
    container,
    root,
    // Awaited: an act() scope that is left open leaks into the next test and
    // makes React render into a container it still believes is unmounted.
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
    },
  }
}

async function flush(): Promise<void> {
  const { act } = await import('react')
  await act(async () => {
    await sleep(0)
  })
}

/** Wait until `predicate` is true, flushing React between attempts. */
async function waitFor(predicate: () => boolean, message: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await sleep(20)
    await flush()
  }
  throw new Error(`timed out waiting for ${message}`)
}

/**
 * Type into a controlled React input.
 *
 * React tracks the previous value on the DOM node, so assigning `.value`
 * directly is ignored as "no change". Using the prototype setter and then
 * dispatching `input` is what a real keystroke looks like to React.
 */
async function type(input: Element, value: string): Promise<void> {
  const { act } = await import('react')
  const element = input as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(
    element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    'value',
  )?.set
  await act(async () => {
    setter?.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
    element.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await flush()
}

async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error('cannot click a missing element')
  const { act } = await import('react')
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await flush()
}

/** Submit a form the way the browser does when Enter is pressed. */
async function submit(form: Element | null): Promise<void> {
  if (!form) throw new Error('form not found')
  const { act } = await import('react')
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
  await flush()
}

const text = () => document.body.textContent ?? ''
const input = (name: string) => document.querySelector(`[name="${name}"]`)

/* ------------------------------------------------------------------- test */

const results: Array<{ name: string; ok: boolean; error?: string }> = []

async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    results.push({ name, ok: true })
    process.stdout.write(`  \u001b[32mok\u001b[0m   ${name}\n`)
  } catch (error) {
    results.push({ name, ok: false, error: String(error) })
    process.stdout.write(`  \u001b[31mFAIL\u001b[0m ${name}\n         ${String(error).replace(/\n/g, '\n         ')}\n`)
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

async function mountQuote(search = '') {
  const { MemoryRouter, Route, Routes } = await import('react-router-dom')
  const { AppProvider } = await import('../src/store/AppStore')
  const { default: Quote } = await import('../src/routes/Quote')
  const { createElement: h } = await import('react')
  return render(
    h(
      MemoryRouter,
      { initialEntries: [`/quote${search}`] },
      h(
        Routes,
        null,
        h(Route, { path: '/quote', element: h(AppProvider, null, h(Quote)) }),
      ),
    ),
  )
}

async function mountCalculator(search = '') {
  const { MemoryRouter } = await import('react-router-dom')
  const { AppProvider } = await import('../src/store/AppStore')
  const { default: Calculator } = await import('../src/routes/Calculator')
  const { createElement: h } = await import('react')
  return render(
    h(
      MemoryRouter,
      { initialEntries: [`/calculator${search}`] },
      h(AppProvider, null, h(Calculator)),
    ),
  )
}

function allButtonsByText(label: string): HTMLElement[] {
  return [...document.querySelectorAll('button')].filter(
    (button) => (button.textContent ?? '').trim().toLowerCase() === label.toLowerCase(),
  ) as HTMLElement[]
}

function quotesOnDisk(): Array<Record<string, unknown>> {
  const file = join(dataDir, 'quotes.jsonl')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function fillValidEnquiry(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    name: 'Adaeze Nwosu',
    phone: '0803 555 1212',
    city: 'Port Harcourt',
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) await type(input(name) as Element, value)
  const select = document.querySelector('select[name="projectType"]') as HTMLSelectElement
  if (select) {
    select.value = 'interior-room'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
    await flush()
  }
  // The consent checkbox is a real input with a label; click it as a visitor does.
  const consent = document.querySelector('input[name="consent"]') as HTMLInputElement | null
  assert(consent, 'no consent control in the form')
  if (!consent.checked) await click(consent)
}

async function main(): Promise<void> {
  process.stdout.write('\nBrowser interaction tests (jsdom + the real enquiry service)\n\n')
  await startService()

  try {
    await check('the quote form refuses an empty submission and points at the first problem', async () => {
      const { unmount } = await mountQuote()
      try {
        await submit(document.querySelector('form'))
        await waitFor(() => text().includes('Please give us a name'), 'the name error')

        const name = input('name') as HTMLInputElement
        assertEqual(name.getAttribute('aria-invalid'), 'true', 'the invalid field is not marked for assistive tech')
        assert(name.getAttribute('aria-describedby'), 'the field error is not associated with the input')
        assertEqual(document.activeElement, name, 'focus did not move to the first invalid field')
        assert(quotesOnDisk().length === 0, 'an invalid submission reached the server')

        // The consent control must be reachable and labelled, not a mystery box.
        const consent = document.querySelector('input[name="consent"]') as HTMLInputElement
        assert(consent, 'no consent checkbox')
        assert(consent.id, 'the consent checkbox has no id, so its label cannot point at it')
        const label = document.querySelector(`label[for="${consent.id}"]`)
        assert((label?.textContent ?? '').trim().length > 10, 'the consent checkbox has no real label')
      } finally {
        await unmount()
      }
    })

    await check('a valid enquiry reaches the service and shows the reference back', async () => {
      const { unmount } = await mountQuote()
      try {
        await fillValidEnquiry()
        await submit(document.querySelector('form'))
        await waitFor(() => /OPD-\d{6}-[0-9A-F]{4}/.test(text()), 'the confirmation with a reference')

        const stored = quotesOnDisk()
        assertEqual(stored.length, 1, 'the enquiry was not stored exactly once')
        assertEqual(stored[0].name, 'Adaeze Nwosu', 'the name was lost between form and record')
        assertEqual(stored[0].city, 'Port Harcourt', 'the city was lost')
        assertEqual(stored[0].projectType, 'interior-room', 'the project type was lost')
        assert(stored[0].consent && (stored[0].consent as { granted: boolean }).granted, 'consent was not recorded')

        // The confirmation must repeat the reference a visitor can quote on the phone.
        const reference = String(stored[0].reference)
        assert(text().includes(reference), 'the confirmation does not show the stored reference')
        assert(text().includes('Colour desk'), 'the confirmation does not say where the enquiry went')
      } finally {
        await unmount()
      }
    })

    await check('when the service refuses a field, the message lands on that input', async () => {
      // The client validates the same rules as the server, so this path is only
      // reachable when the two drift — which is precisely why the mapping code
      // needs its own test rather than being trusted. The response below is the
      // exact 422 shape the service produces (see server/index.test.mjs).
      const forced: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: 'Some details need attention.',
            fields: { phone: 'A reachable phone number is required.' },
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        )

      const original = globalThis.fetch
      const { unmount } = await mountQuote()
      try {
        await fillValidEnquiry()
        globalThis.fetch = forced
        await submit(document.querySelector('form'))
        await waitFor(() => text().includes('A reachable phone number is required'), 'the server field error')

        const phone = input('phone') as HTMLInputElement
        assertEqual(phone.getAttribute('aria-invalid'), 'true', 'the server error is not tied to the field')
        assertEqual(document.activeElement, phone, 'focus did not move to the refused field')
        assertEqual((input('name') as HTMLInputElement).value, 'Adaeze Nwosu', 'the visitor had to retype the form')
      } finally {
        globalThis.fetch = original
        await unmount()
      }
    })

    await check('the honeypot looks successful to a bot and stores nothing', async () => {
      const before = quotesOnDisk().length
      const { unmount } = await mountQuote()
      try {
        await fillValidEnquiry({ name: 'Spam Bot' })
        const honeypot = input('company') as HTMLInputElement
        assert(honeypot, 'the honeypot field is missing')
        await type(honeypot, 'ACME SEO')
        await submit(document.querySelector('form'))
        await waitFor(() => /OPD-\d{6}-[0-9A-F]{4}/.test(text()), 'the decoy confirmation')
        assertEqual(quotesOnDisk().length, before, 'a honeypot submission was stored')
      } finally {
        await unmount()
      }
    })

    await check('the calculator turns room dimensions into an area, packs and a figure', async () => {
      const { unmount } = await mountCalculator()
      try {
        const panel = () => document.querySelector('.lg\\:sticky')?.textContent ?? ''
        await type(document.getElementById('len') as Element, '4.2')
        await type(document.getElementById('wid') as Element, '3.6')
        await type(document.getElementById('hei') as Element, '2.9')
        await waitFor(() => /Paintable area/.test(panel()), 'the result panel')

        const startingArea = Number(/Paintable area\s*([\d.]+) m²/.exec(panel())?.[1])
        assert(Number.isFinite(startingArea) && startingArea > 0, `no paintable area in "${panel().slice(0, 120)}"`)
        assert(/Total incl\. 5% handling/.test(panel()), 'the handling allowance is not shown')
        assert(/₦/.test(panel()) || /Ask dealer/.test(panel()), 'no price treatment at all')
        assert(/Indicative Port Harcourt retail guide/.test(panel()), 'the guide-price disclaimer is missing')

        // The whole point of a calculator is that it follows the input.
        await type(document.getElementById('hei') as Element, '4.0')
        await waitFor(() => {
          const next = Number(/Paintable area\s*([\d.]+) m²/.exec(panel())?.[1])
          return Number.isFinite(next) && next > startingArea
        }, 'the area to grow with the wall height')

        // Pack rounding is what the visitor buys, so there must be a pack list.
        await waitFor(() => /\d+ × \d+ L/.test(panel()), 'a pack combination to buy')
      } finally {
        await unmount()
      }
    })

    await check('the calculator accepts a measured wall area instead of dimensions', async () => {
      const { unmount } = await mountCalculator()
      try {
        const panel = () => document.querySelector('.lg\\:sticky')?.textContent ?? ''
        await click(allButtonsByText('Wall area')[0])
        await waitFor(() => Boolean(document.getElementById('area')), 'the wall-area input')
        await type(document.getElementById('area') as Element, '120')
        // 120 m² plus the default 8% trim allowance for reveals and cutting-in.
        await waitFor(() => /Paintable area\s*129\.6 m²/.test(panel()), 'the entered area to carry through')
        await waitFor(() => /\d+ × \d+ L/.test(panel()), 'a pack combination')
      } finally {
        await unmount()
      }
    })

    await check('switching to feet changes what the fields are asking for', async () => {
      const { unmount } = await mountCalculator()
      try {
        assert(
          (document.querySelector('label[for="len"]')?.textContent ?? '').includes('(m)'),
          'the metric label is not shown to begin with',
        )
        await click(allButtonsByText('Feet')[0])
        await waitFor(
          () => (document.querySelector('label[for="len"]')?.textContent ?? '').includes('(ft)'),
          'the imperial label',
        )
        await type(document.getElementById('len') as Element, '13')
        const panel = document.querySelector('.lg\\:sticky')?.textContent ?? ''
        assert(!/NaN|Infinity/.test(panel), 'the unit conversion produced an unusable number')
      } finally {
        await unmount()
      }
    })
  } finally {
    stopService()
    rmSync(dataDir, { recursive: true, force: true })
  }

  const failed = results.filter((result) => !result.ok)
  process.stdout.write(`\n${results.length - failed.length} passed, ${failed.length} failed\n`)
  if (failed.length) {
    for (const result of failed) process.stdout.write(`\n${result.name}\n${result.error}\n`)
    process.exitCode = 1
  }
}

await main()
