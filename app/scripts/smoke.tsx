/**
 * Route smoke test.
 *
 * Renders every route through react-dom/server, so a page that throws, loses its
 * <h1>, or links to a URL that does not exist fails here rather than in a
 * browser. Server rendering runs no effects, which is exactly the point: it
 * isolates render-time faults (bad props, missing data, null dereferences) from
 * anything that needs a live DOM.
 *
 *   npm run test:routes
 */
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from '../src/store/AppStore'

import Home from '../src/routes/Home'
import Colours from '../src/routes/Colours'
import ColourDetail from '../src/routes/ColourDetail'
import Products from '../src/routes/Products'
import ProductDetail from '../src/routes/ProductDetail'
import RoomPreview from '../src/routes/RoomPreview'
import Calculator from '../src/routes/Calculator'
import Inspiration from '../src/routes/Inspiration'
import ProjectDetail from '../src/routes/ProjectDetail'
import Advice from '../src/routes/Advice'
import GuideDetail from '../src/routes/GuideDetail'
import Dealers from '../src/routes/Dealers'
import Quote from '../src/routes/Quote'
import About from '../src/routes/About'
import DataPage from '../src/routes/DataPage'
import StyleGuide from '../src/routes/StyleGuide'
import Legal from '../src/routes/Legal'
import NotFound from '../src/routes/NotFound'
import { Header } from '../src/components/layout/Header'
import { Footer } from '../src/components/layout/Footer'

const cases: Array<{ pattern: string; path: string; Page: () => JSX.Element }> = [
  { pattern: '/', path: '/', Page: Home },
  { pattern: '/colours', path: '/colours', Page: Colours },
  { pattern: '/colours', path: '/colours?family=Green&view=grid', Page: Colours },
  { pattern: '/colours/:id', path: '/colours/palm-shadow', Page: ColourDetail },
  { pattern: '/products', path: '/products', Page: Products },
  { pattern: '/products/:id', path: '/products/matt', Page: ProductDetail },
  { pattern: '/products/:id', path: '/products/screeding', Page: ProductDetail },
  { pattern: '/room-preview', path: '/room-preview?colour=lilac-room', Page: RoomPreview },
  { pattern: '/calculator', path: '/calculator?product=silk', Page: Calculator },
  { pattern: '/inspiration', path: '/inspiration', Page: Inspiration },
  { pattern: '/inspiration/:id', path: '/inspiration/arched-villa-gra', Page: ProjectDetail },
  { pattern: '/advice', path: '/advice', Page: Advice },
  { pattern: '/advice/:id', path: '/advice/how-much-paint', Page: GuideDetail },
  { pattern: '/dealers', path: '/dealers?q=lekki', Page: Dealers },
  { pattern: '/quote', path: '/quote', Page: Quote },
  { pattern: '/quote', path: '/quote?type=sample&colour=bone', Page: Quote },
  { pattern: '/about', path: '/about', Page: About },
  { pattern: '/data', path: '/data', Page: DataPage },
  { pattern: '/style-guide', path: '/style-guide', Page: StyleGuide },
  { pattern: '/legal/:slug', path: '/legal/privacy', Page: Legal },
  { pattern: '*', path: '/this-page-does-not-exist', Page: NotFound },
]

/** Every routable path prefix the app owns. */
const KNOWN = [
  '/', '/colours', '/products', '/room-preview', '/calculator', '/inspiration',
  '/advice', '/dealers', '/quote', '/about', '/data', '/style-guide', '/legal',
]

let failures = 0
const fail = (message: string) => {
  failures += 1
  console.error(`  FAIL ${message}`)
}

for (const { pattern, path, Page } of cases) {
  const html = renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>
        <Routes>
          <Route path={pattern} element={<Page />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>,
  )

  if (!/<h1[\s>]/.test(html)) fail(`${path} has no h1`)
  for (const bad of ['undefined', 'NaN', '[object Object]', '&lt;script']) {
    if (html.includes(bad)) fail(`${path} renders "${bad}"`)
  }

  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((match) => match[1])
  for (const href of new Set(hrefs)) {
    const known = KNOWN.some((prefix) => href === prefix || href.startsWith(`${prefix}/`))
    if (!known && !href.startsWith('/media/') && !href.startsWith('/brand/') && !href.startsWith('/documents/')) {
      fail(`${path} links to unknown route ${href}`)
    }
  }

  console.log(`  ok   ${path.padEnd(38)} ${html.length.toLocaleString()} chars`)
}

/* ---------------------------------------------------------------- layout */
const layout = renderToString(
  <MemoryRouter initialEntries={['/']}>
    <AppProvider>
      <Header onOpenSearch={() => {}} />
      <Footer />
    </AppProvider>
  </MemoryRouter>,
)

for (const required of ['0902 642 4350', 'digital approximations', 'Built to WCAG 2.2 AA']) {
  if (!layout.includes(required)) fail(`layout is missing "${required}"`)
}
if (!layout.includes('href="tel:+2349026424350"')) fail('footer has no dialable phone link')
if (!layout.includes('href="#main"')) fail('header has no skip link')
console.log(`  ok   header + footer (${layout.length.toLocaleString()} chars)`)

if (failures) {
  console.error(`\n${failures} route failure(s)`)
  process.exitCode = 1
} else {
  console.log(`\n${cases.length} routes rendered`)
}
