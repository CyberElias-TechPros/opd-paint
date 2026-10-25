/**
 * Head prerender.
 *
 * The site is a single-page app, so without this every URL would ship the same
 * <title>, the same description and the same social card. Search engines run
 * JavaScript, but link previews, some crawlers and the browser's own tab title
 * do not — so after `vite build` this renders each route to a string purely to
 * *collect* its metadata, then writes a copy of index.html with that head in
 * place.
 *
 * What it deliberately does not do is prerender the body. The app mounts with
 * createRoot, which discards any server markup anyway, and hydration would
 * require the prerendered tree to match state that lives in local storage. The
 * head is the part a crawler reads before any JavaScript runs; that is what is
 * generated here, at ~1 KB per page instead of a duplicated app.
 *
 * Run automatically by `npm run build` (through vite's SSR build, since this
 * file contains JSX).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from '../src/store/AppStore'
import { ORIGIN, pageTitle, takeRenderedMeta } from '../src/lib/seo'

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

import { COLORS } from '../src/data/colors'
import { PRODUCTS } from '../src/data/products'
import { PROJECTS } from '../src/data/projects'
import { GUIDES } from '../src/data/guides'

const DIST = join(process.cwd(), 'dist')
const template = readFileSync(join(DIST, 'index.html'), 'utf8')

type Page = { pattern: string; url: string; Page: () => React.ReactElement }

const pages: Page[] = [
  { pattern: '/', url: '/', Page: Home },
  { pattern: '/colours', url: '/colours', Page: Colours },
  { pattern: '/products', url: '/products', Page: Products },
  { pattern: '/room-preview', url: '/room-preview', Page: RoomPreview },
  { pattern: '/calculator', url: '/calculator', Page: Calculator },
  { pattern: '/inspiration', url: '/inspiration', Page: Inspiration },
  { pattern: '/advice', url: '/advice', Page: Advice },
  { pattern: '/dealers', url: '/dealers', Page: Dealers },
  { pattern: '/quote', url: '/quote', Page: Quote },
  { pattern: '/about', url: '/about', Page: About },
  { pattern: '/data', url: '/data', Page: DataPage },
  { pattern: '/style-guide', url: '/style-guide', Page: StyleGuide },
  ...COLORS.map((colour) => ({ pattern: '/colours/:id', url: `/colours/${colour.id}`, Page: ColourDetail })),
  ...PRODUCTS.map((product) => ({ pattern: '/products/:id', url: `/products/${product.id}`, Page: ProductDetail })),
  ...PROJECTS.map((project) => ({ pattern: '/inspiration/:id', url: `/inspiration/${project.id}`, Page: ProjectDetail })),
  ...GUIDES.map((guide) => ({ pattern: '/advice/:id', url: `/advice/${guide.id}`, Page: GuideDetail })),
  ...['privacy', 'terms', 'accessibility'].map((slug) => ({ pattern: '/legal/:slug', url: `/legal/${slug}`, Page: Legal })),
]

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Replace a head tag, or insert it, tolerating the template's line wrapping. */
const setTag = (html: string, pattern: RegExp, tag: string) =>
  pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)

const metaTag = (key: string, content: string) =>
  `<meta ${key} content="${escape(content)}" />`

/** `<meta name="description" …>` written across several lines still has to match. */
const metaPattern = (key: string) => new RegExp('<meta\\s+(?=[^>]*' + key + ')[^>]*>')

let written = 0
const orphans: string[] = []

for (const { pattern, url, Page } of pages) {
  const body = renderToString(
    <MemoryRouter initialEntries={[url]}>
      <AppProvider>
        <Routes>
          <Route path={pattern} element={<Page />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>,
  )

  const meta = takeRenderedMeta()
  if (!meta) {
    orphans.push(url)
    continue
  }

  const title = pageTitle(meta.title)
  const description = meta.description.slice(0, 300)
  const canonical = `${ORIGIN}${meta.path ?? url}`
  const image = `${ORIGIN}${meta.image ?? '/media/og-card.jpg'}`

  let html = template
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
  html = setTag(html, metaPattern('name="description"'), metaTag('name="description"', description))
  html = setTag(html, /<link rel="canonical"[^>]*\/?>/, `<link rel="canonical" href="${canonical}" />`)
  html = setTag(html, metaPattern('property="og:title"'), metaTag('property="og:title"', title))
  html = setTag(html, metaPattern('property="og:description"'), metaTag('property="og:description"', description))
  html = setTag(html, metaPattern('property="og:url"'), metaTag('property="og:url"', canonical))
  html = setTag(html, metaPattern('property="og:image"'), metaTag('property="og:image"', image))
  html = setTag(
    html,
    metaPattern('name="robots"'),
    metaTag('name="robots"', meta.noIndex ? 'noindex,nofollow' : 'index,follow'),
  )
  if (meta.jsonLd) {
    const blocks = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]
    const ld = blocks
      .map((block) => `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`)
      .join('\n    ')
    html = html.replace('</head>', `    ${ld}\n  </head>`)
  }

  // The home page opens with the finished-villa photograph; telling the browser
  // about it before the JavaScript parses is worth roughly a second of LCP on a
  // Nigerian mobile connection. Other routes get no preload because they do not
  // use this image.
  if (url === '/') {
    html = html.replace(
      '</head>',
      [
        '    <link rel="preload" as="image" href="/media/project-finished-villa.webp" media="(min-width: 721px)" fetchpriority="high" />',
        '    <link rel="preload" as="image" href="/media/project-finished-villa-640.webp" media="(max-width: 720px)" fetchpriority="high" />',
        '  </head>',
      ].join('\n'),
    )
  }

  // `/` stays dist/index.html; everything else gets its own directory.
  const file = url === '/' ? join(DIST, 'index.html') : join(DIST, url.replace(/^\//, ''), 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  written += 1

  if (body.length < 200) console.warn(`  warn ${url} rendered only ${body.length} chars`)
}

if (orphans.length) {
  console.error(`Routes with no metadata: ${orphans.join(', ')}`)
  process.exitCode = 1
}

// A missing tag in the shell would be silently inserted instead of replaced,
// so list what the template is missing once, rather than per page.
for (const [label, pattern] of [
  ['<title>', /<title>[^<]*<\/title>/],
  ['canonical', /<link rel="canonical"/],
  ['og:type', /property="og:type"/],
] as const) {
  if (!pattern.test(template)) console.warn(`  warn index.html has no ${label}`)
}

console.log(`prerendered ${written} page head(s) into dist/`)
