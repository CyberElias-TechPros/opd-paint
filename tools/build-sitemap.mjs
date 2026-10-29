#!/usr/bin/env node
/**
 * Regenerate app/public/sitemap.xml from the data files.
 *
 * A sitemap that lists routes which no longer exist — or omits half the colour
 * library — is worse than no sitemap, so it is generated rather than typed. Run
 * it after adding a colour, product, guide or project:
 *
 *   node tools/build-sitemap.mjs [https://opudapaint.com]
 *
 * The origin is a parameter because the production domain is not yet confirmed;
 * the default matches the address printed on the generated data sheets.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const origin = (process.argv[2] ?? 'https://opudapaint.com').replace(/\/$/, '')

/** Pull ids straight out of the data modules — the same source the app reads. */
const ids = async (file, marker) => {
  const source = await readFile(join(root, 'app/src/data', file), 'utf8')
  // Only the array that follows the marker, so ids from later helpers in the
  // same module cannot leak in.
  const after = source.split(marker)[1] ?? ''
  const nextExport = after.search(/\nexport /)
  const block = nextExport === -1 ? after : after.slice(0, nextExport)
  const found = [...block.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((match) => match[1])
  return [...new Set(found)]
}

const staticRoutes = [
  ['/', '1.0', 'weekly'],
  ['/colours', '0.9', 'weekly'],
  ['/products', '0.9', 'monthly'],
  ['/room-preview', '0.8', 'monthly'],
  ['/calculator', '0.8', 'monthly'],
  ['/inspiration', '0.8', 'monthly'],
  ['/advice', '0.8', 'weekly'],
  ['/advice/surface-prep', '0.7', 'monthly'],
  ['/dealers', '0.8', 'weekly'],
  ['/quote', '0.7', 'monthly'],
  ['/about', '0.6', 'yearly'],
  ['/data', '0.4', 'monthly'],
]

// Colours, products and guides are declared as a `*_BASE` array and then
// re-exported under their public name after the admin-override layer is
// applied (see app/src/lib/contentOverrides.ts) — the marker has to point at
// the array literal itself, not the one-line re-export, or this finds zero ids.
const [colors, products, guides, projects] = await Promise.all([
  ids('colors.ts', 'const COLORS_BASE'),
  ids('products.ts', 'const PRODUCTS_BASE'),
  ids('guides.ts', 'const GUIDES_BASE'),
  ids('projects.ts', 'export const PROJECTS'),
])

const url = (path, priority, changefreq) =>
  `  <url>\n    <loc>${origin}${path}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`

const entries = [
  ...staticRoutes.map(([path, priority, freq]) => url(path, priority, freq)),
  ...colors.map((id) => url(`/colours/${id}`, '0.6', 'monthly')),
  ...products.map((id) => url(`/products/${id}`, '0.7', 'monthly')),
  ...guides.map((id) => url(`/advice/${id}`, '0.6', 'monthly')),
  ...projects.map((id) => url(`/inspiration/${id}`, '0.5', 'yearly')),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`

await writeFile(join(root, 'app/public/sitemap.xml'), xml)
console.log(
  `sitemap: ${entries.length} urls (${colors.length} colours, ${products.length} products, ${guides.length} guides, ${projects.length} projects)`,
)
