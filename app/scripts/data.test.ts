/**
 * Content integrity tests — run with `npm test`.
 *
 * The README's first quality standard is colour trustworthiness and its second
 * is product accuracy. Both are data problems, not UI problems, so they are
 * tested here: the build refuses to ship a library with a broken hex, a palette
 * pointing at a colour that no longer exists, a product recommending another
 * product's coverage, or an image that is not in the media manifest.
 *
 * Node 22 strips the TypeScript types natively, so no test framework is needed.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COLORS, FAMILIES, findColor } from '../src/data/colors.ts'
import { PALETTES, findPalette } from '../src/data/palettes.ts'
import { PRODUCTS, findProduct } from '../src/data/products.ts'
import { DEALERS, STATES, directionsUrl, distanceKm } from '../src/data/dealers.ts'
import { GUIDES } from '../src/data/guides.ts'
import { PROJECTS } from '../src/data/projects.ts'
import { LEGAL_DOCS, findLegalDoc } from '../src/data/legal.ts'
import { BRAND_DOCUMENTS } from '../src/data/documents'
import { INK, PAPER, contrast, estimateLrv, readableInk, swatchText } from '../src/lib/color.ts'
import { ALT } from '../src/lib/media.ts'

let passed = 0
// Typed because `tsc -b` now covers the test scripts too (tsconfig.scripts.json):
// an untyped runner is how a suite keeps passing after the module it exercises
// changes shape.
const test = (name: string, fn: () => void) => {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}`)
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  }
}

/**
 * Composite `foreground` over `background` at `alpha`, the way a browser does,
 * so a test can reason about `bg-paper-2/8` over `bg-ink` instead of guessing at
 * the resulting hex.
 */
function blend(foreground: string, background: string, alpha: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16)
  const mixed = [1, 3, 5].map((offset) =>
    Math.round(channel(foreground, offset) * alpha + channel(background, offset) * (1 - alpha)),
  )
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

const manifest = JSON.parse(
  readFileSync(new URL('../public/media/manifest.json', import.meta.url), 'utf8'),
)
const mediaKeys = new Set(Object.keys(manifest.images ?? manifest))
const HEX = /^#[0-9A-F]{6}$/

console.log('content integrity')

/* ------------------------------------------------------------------ colours */

test('every brand document is a real file, and every real file is accounted for', () => {
  // The other direction matters as much as this one: a PDF dropped into
  // public/documents that no list mentions is a document the website cannot link and
  // the app cannot name, and nothing else in the build would notice it.
  const onDisk = readdirSync(new URL('../public/documents', import.meta.url)).filter((name) =>
    name.endsWith('.pdf'),
  )
  for (const document of BRAND_DOCUMENTS) {
    assert.ok(onDisk.includes(document.file), `${document.file} is listed but does not exist`)
  }
  const sheets = new Set(
    PRODUCTS.flatMap((product) => product.tds.map((sheet) => sheet.href.split('/').pop())),
  )
  const listed = new Set(BRAND_DOCUMENTS.map((document) => document.file))
  const unaccounted = onDisk.filter((name) => !listed.has(name) && !sheets.has(name))
  assert.deepEqual(unaccounted, [], 'PDFs that nothing lists')
})

test('exactly one document is not bundled, and it is the catalogue', () => {
  // The app copies every PDF into the APK except this one, so a second entry here means
  // a document the app will offer and then fail to open.
  assert.deepEqual(
    BRAND_DOCUMENTS.filter((document) => !document.bundled).map((document) => document.file),
    ['opudas-catalogue.pdf'],
  )
})

test('every brand document has a title, a detail and an href that matches its file', () => {
  for (const document of BRAND_DOCUMENTS) {
    assert.ok(document.title.length > 0, `${document.file} has no title`)
    assert.ok(document.detail.length > 0, `${document.file} has no detail`)
    assert.equal(document.href, `/documents/${document.file}`)
    assert.ok(document.trackTarget.length > 0, `${document.file} has no analytics target`)
  }
})

test(`${COLORS.length} colours have unique ids and codes`, () => {
  assert.equal(new Set(COLORS.map((c) => c.id)).size, COLORS.length, 'duplicate colour id')
  assert.equal(new Set(COLORS.map((c) => c.code)).size, COLORS.length, 'duplicate colour code')
})

test('every colour hex is a valid six-digit uppercase hex', () => {
  const bad = COLORS.filter((c) => !HEX.test(c.hex))
  assert.deepEqual(bad.map((c) => c.id), [], 'invalid hex values')
})

test('codes follow the OP-### pattern', () => {
  const bad = COLORS.filter((c) => !/^OP-\d{3}$/.test(c.code))
  assert.deepEqual(bad.map((c) => c.code), [])
})

test('every colour has a name, note, family, undertone, rooms and collection', () => {
  for (const colour of COLORS) {
    assert.ok(colour.name.length > 2, `${colour.id} name`)
    assert.ok(colour.note.length > 30, `${colour.id} note too short to be useful`)
    assert.ok(colour.family, `${colour.id} family`)
    assert.ok(colour.undertone, `${colour.id} undertone`)
    assert.ok(colour.rooms.length > 0, `${colour.id} rooms`)
    assert.ok(colour.collection, `${colour.id} collection`)
    assert.ok(colour.source, `${colour.id} provenance source`)
  }
})

test('derived LRV is between 0 and 100 for every colour', () => {
  for (const colour of COLORS) {
    const lrv = colour.measuredLrv ?? estimateLrv(colour.hex)
    assert.ok(lrv >= 0 && lrv <= 100, `${colour.id} lrv ${lrv}`)
  }
})

test('swatchText never asks for small text directly on a mid-tone paint', () => {
  // Mid-tone paint values have no 4.5:1 text colour at all. The rule the UI is
  // built on: when `plate` is true the label must sit on a plate, so the only
  // contrast the component has to guarantee is ink-on-paper.
  for (const colour of COLORS) {
    const { text, plate } = swatchText(colour.hex)
    assert.ok([INK, PAPER].includes(text), `${colour.id} unexpected text colour ${text}`)
    if (plate) {
      assert.ok(contrast(colour.hex, text) < 4.5, `${colour.id} flagged plate unnecessarily`)
    } else {
      assert.ok(contrast(colour.hex, text) >= 4.5, `${colour.id} direct text ${contrast(colour.hex, text).toFixed(2)}`)
    }
  }
})

test('the label plate itself meets AA in both directions', () => {
  assert.ok(contrast(INK, PAPER) >= 7, 'ink on paper is below AAA')
  assert.ok(contrast(PAPER, INK) >= 7, 'paper on ink is below AAA')
})

test('readableInk always returns the higher-contrast option', () => {
  for (const colour of COLORS) {
    const chosen = readableInk(colour.hex)
    const best = Math.max(contrast(colour.hex, INK), contrast(colour.hex, PAPER))
    assert.ok(Math.abs(contrast(colour.hex, chosen) - best) < 0.01, `${colour.id} chose the worse text colour`)
  }
})

test('findColor resolves by id and returns undefined for junk', () => {
  assert.equal(findColor(COLORS[0].id)?.id, COLORS[0].id)
  assert.equal(findColor('not-a-colour'), undefined)
})

test('the library covers every declared family at least once', () => {
  // Iterating the declared list rather than a copy of it: a family added to the
  // type with no colour behind it fails here instead of quietly narrowing the
  // library's filters.
  const families = new Set(COLORS.map((c) => c.family))
  for (const family of FAMILIES) {
    assert.ok(families.has(family), `no colour in ${family}`)
  }
})

/* ----------------------------------------------------------------- palettes */

test('every palette colour id exists in the library', () => {
  for (const palette of PALETTES) {
    for (const id of palette.colors) {
      assert.ok(findColor(id), `${palette.id} references missing colour ${id}`)
    }
  }
})

test('palettes declare one role per colour', () => {
  for (const palette of PALETTES) {
    assert.equal(palette.roles.length, palette.colors.length, `${palette.id} roles/colours mismatch`)
  }
})

test('palette images exist in the media manifest', () => {
  for (const palette of PALETTES) {
    assert.ok(mediaKeys.has(palette.image), `${palette.id} image ${palette.image} missing`)
  }
})

/* ----------------------------------------------------------------- products */

test(`${PRODUCTS.length} products have unique ids and SKUs`, () => {
  assert.equal(new Set(PRODUCTS.map((p) => p.id)).size, PRODUCTS.length)
  assert.equal(new Set(PRODUCTS.map((p) => p.sku)).size, PRODUCTS.length)
})

test('every product declares coverage, coats, dry times and a guarantee position', () => {
  for (const product of PRODUCTS) {
    assert.ok(product.coveragePerUnit > 0, `${product.id} coverage`)
    assert.ok(product.coatsRecommended >= 1 && product.coatsRecommended <= 3, `${product.id} coats`)
    assert.ok(product.touchDryHours > 0 && product.recoatHours > 0, `${product.id} dry times`)
    assert.ok(product.fullCureDays > 0, `${product.id} cure`)
    assert.ok(product.claimsStatus, `${product.id} claims status`)
    assert.ok(product.tds.length > 0, `${product.id} technical documents`)
    assert.ok(product.application.length >= 3, `${product.id} application steps`)
  }
})

test('pack sizes are unique and listed largest first', () => {
  for (const product of PRODUCTS) {
    const sizes = product.packs.map((pack) => pack.size)
    assert.equal(sizes.length, new Set(sizes).size, `${product.id} duplicate pack size`)
    sizes.slice(1).forEach((size, index) => {
      assert.ok(size < sizes[index], `${product.id} packs are not largest-first: ${sizes.join(', ')}`)
    })
    assert.equal(sizes.at(-1), Math.min(...sizes), `${product.id} smallest pack missing`)
  }
})

test('interior products sell a pack a household can carry home', () => {
  // Textured exterior systems are genuinely trade-pack only (10 L and 20 L);
  // anything a DIY customer is told to buy must exist in a small pack.
  const diy = PRODUCTS.filter((p) => p.surfaces.some((surface) => /Interior|Ceiling/.test(surface)))
  for (const product of diy) {
    const retail = product.packs.some((pack) => pack.size <= (pack.unit === 'kg' ? 10 : 5))
    assert.ok(retail, `${product.id} has no pack small enough to carry home`)
  }
})

test('no pack carries a price — pricing is not part of the data model', () => {
  for (const product of PRODUCTS) {
    for (const pack of product.packs) {
      assert.ok(!('guidePrice' in pack), `${product.id} ${pack.size} still carries a guidePrice field`)
      assert.deepEqual(
        Object.keys(pack).sort(),
        ['inStock', 'size', 'unit'],
        `${product.id} ${pack.size} has unexpected pack fields`,
      )
    }
  }
})

test('product images and gallery entries exist in the media manifest', () => {
  for (const product of PRODUCTS) {
    const used = [product.image, ...product.gallery].filter(Boolean)
    for (const name of used) {
      assert.ok(mediaKeys.has(name), `${product.id} image ${name} missing from manifest`)
    }
  }
})

test('technical document links point at generated PDFs', () => {
  for (const product of PRODUCTS) {
    for (const doc of product.tds) {
      assert.ok(doc.href.startsWith('/documents/'), `${product.id} ${doc.label} not a document path`)
      const file = new URL(`../public${doc.href}`, import.meta.url)
      const bytes = readFileSync(file)
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', `${doc.href} is not a PDF`)
    }
  }
})

test('findProduct resolves by id', () => {
  assert.equal(findProduct('matt')?.id, 'matt')
  assert.equal(findProduct('unobtainium'), undefined)
})

/* ------------------------------------------------------------------ dealers */

test('dealer ids are unique and coordinates are inside Nigeria', () => {
  assert.equal(new Set(DEALERS.map((d) => d.id)).size, DEALERS.length)
  for (const dealer of DEALERS) {
    assert.ok(dealer.lat > 3.8 && dealer.lat < 13.9, `${dealer.id} lat ${dealer.lat}`)
    assert.ok(dealer.lng > 2.6 && dealer.lng < 14.7, `${dealer.id} lng ${dealer.lng}`)
    assert.ok(dealer.services.length > 0, `${dealer.id} services`)
    assert.ok(dealer.hours.length > 0, `${dealer.id} hours`)
  }
})

test('distance maths is sane and symmetric', () => {
  const counter = DEALERS.find((d) => d.id === 'ph-trans-amadi')
  const gra = DEALERS.find((d) => d.id === 'ph-gra')
  assert.ok(counter && gra, 'expected the two Port Harcourt counters')
  assert.equal(distanceKm(counter.lat, counter.lng, counter.lat, counter.lng), 0, 'self distance')
  const there = distanceKm(counter.lat, counter.lng, gra.lat, gra.lng)
  const back = distanceKm(gra.lat, gra.lng, counter.lat, counter.lng)
  assert.equal(there, back, 'distance not symmetric')
  assert.ok(there > 1 && there < 40, `implausible Port Harcourt distance ${there} km`)
})

test('the network is anchored in Port Harcourt, the factory city', () => {
  const ph = DEALERS.filter((d) => d.city === 'Port Harcourt')
  assert.ok(ph.length >= 3, `expected several Port Harcourt counters, found ${ph.length}`)
  assert.ok(DEALERS.some((d) => d.kind === 'Brand trade counter' && d.city === 'Port Harcourt'), 'no brand counter in the factory city')
  assert.ok(STATES.includes('Rivers'), 'Rivers State missing from the network')
})

test('directions links are valid maps URLs', () => {
  for (const dealer of DEALERS) {
    const url = directionsUrl(dealer)
    assert.ok(url.startsWith('https://www.google.com/maps/dir/'), `${dealer.id} directions url`)
    assert.ok(url.includes(String(dealer.lat)), `${dealer.id} missing lat`)
  }
})

/* ------------------------------------------------- guides and case studies */

test('guide ids are unique and every guide has sections, a reviewer and a hero image', () => {
  assert.equal(new Set(GUIDES.map((g) => g.id)).size, GUIDES.length)
  for (const guide of GUIDES) {
    assert.ok(guide.category, `${guide.id} category`)
    assert.ok(guide.sections.length >= 3, `${guide.id} needs at least three sections`)
    assert.ok(guide.readMinutes > 0, `${guide.id} read time`)
    assert.ok(guide.reviewer, `${guide.id} needs a named reviewer`)
    assert.ok(guide.updated, `${guide.id} needs a review date`)
    assert.ok(mediaKeys.has(guide.hero), `${guide.id} hero ${guide.hero} missing from manifest`)
    for (const section of guide.sections) {
      assert.ok(section.heading && section.paragraphs.length > 0, `${guide.id} empty section`)
    }
  }
})

test('guides end in an action a reader can take', () => {
  for (const guide of GUIDES) {
    assert.ok((guide.relatedColors.length > 0) || (guide.relatedProducts.length > 0), `${guide.id} has no next step`)
  }
})

test('guide colour and product references resolve', () => {
  for (const guide of GUIDES) {
    for (const id of guide.relatedColors) {
      assert.ok(findColor(id), `${guide.id} references missing colour ${id}`)
    }
    for (const id of guide.relatedProducts) {
      assert.ok(findProduct(id), `${guide.id} references missing product ${id}`)
    }
  }
})

test('project ids are unique, media exists and colour/product links resolve', () => {
  assert.equal(new Set(PROJECTS.map((p) => p.id)).size, PROJECTS.length)
  for (const project of PROJECTS) {
    assert.ok(mediaKeys.has(project.cover), `${project.id} cover ${project.cover} missing`)
    for (const name of project.gallery) {
      assert.ok(mediaKeys.has(name), `${project.id} gallery image ${name} missing`)
    }
    for (const colourId of project.colorIds) {
      assert.ok(findColor(colourId), `${project.id} references missing colour ${colourId}`)
    }
    for (const productId of project.productIds) {
      assert.ok(findProduct(productId), `${project.id} references missing product ${productId}`)
    }
    // paletteId is optional: site photography without a confirmed colour spec
    // (e.g. supplied after the fact with no job sheet) is filed with
    // paletteId: '' rather than guessed at — ProjectDetail hides the "curated
    // as" line in that case. Where a paletteId is given, it must resolve.
    if (project.paletteId) {
      assert.ok(findPalette(project.paletteId), `${project.id} references missing palette ${project.paletteId}`)
    }
  }
})

test('concept renders are never filed as completed site work', () => {
  for (const project of PROJECTS) {
    if (project.cover.startsWith('render-modern')) {
      assert.notEqual(project.stage, 'completed', `${project.id} is a render but marked completed`)
      assert.equal(project.kind, 'Concept design', `${project.id} render must be labelled a concept`)
    }
  }
})

/* -------------------------------------------------------------------- media */

test('every media key has alt text, and no alt text is a placeholder', () => {
  for (const key of mediaKeys) {
    const alt = ALT[key]
    assert.ok(alt, `${key} has no alt text in lib/media.ts`)
    assert.ok(alt.length > 40, `${key} alt text is too short to describe the image`)
    assert.ok(!/^(image|photo|picture)\b/i.test(alt), `${key} alt text is a placeholder`)
    assert.ok(!/\b(image|photo) of\b/i.test(alt), `${key} alt text starts by describing itself`)
  }
})

test('no alt text claims a digital swatch matches physical paint', () => {
  for (const [key, alt] of Object.entries(ALT)) {
    assert.ok(!/exact(ly)? match(es)?/i.test(alt), `${key} implies an exact colour match`)
  }
})

test('every image in the manifest is actually used by the interface', () => {
  // The brief was to use the company's own photographs, so a key that ships but
  // never appears is dead weight in the bundle and a missed opportunity.
  const root = fileURLToPath(new URL('../src', import.meta.url))
  const source = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    .join('\n')
  const unused = [...mediaKeys].filter((key) => !source.includes(`'${key}'`) && !source.includes(`"${key}"`))
  assert.deepEqual(unused, [], 'manifest images not referenced anywhere')
})

/* ------------------------------------------------ accents on dark surfaces */

test('the accents used for text on a dark panel clear AA', () => {
  // axe caught three contrast failures on the finish finder's specification
  // panel: a `green` badge at 2.59:1 and a `green-bright` link at 3.85:1, both
  // on surfaces darker than the paper they were designed for. This is the same
  // check without a browser, reading the real tokens out of the stylesheet so it
  // cannot drift from them — the next pairing like that fails here, in
  // `npm test`, instead of in CI on a page nobody has looked at yet.
  const theme = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8')
  const token = (name: string): string => {
    const match = theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
    assert.ok(match, `--color-${name} is not defined in theme.css`)
    return match[1]
  }

  const ink = token('ink')
  // The panel sections inside a dark card, as axe measured them: ink under a
  // paper-2 wash. Computed rather than hardcoded, so a change to either token is
  // reflected here.
  const tinted = blend(token('paper-2'), ink, 0.08)
  const accents: Array<[string, string]> = [
    ['green-mist', token('green-mist')],
    ['paper-2', token('paper-2')],
    ['gold', token('gold')],
  ]
  for (const [name, foreground] of accents) {
    for (const [surface, background] of [['ink', ink], ['a tinted dark panel', tinted]] as const) {
      const ratio = contrast(foreground, background)
      assert.ok(
        ratio >= 4.5,
        `${name} on ${surface} is ${ratio.toFixed(2)}:1 — under the 4.5:1 AA requires for text this small`,
      )
    }
  }
})

/* ------------------------------------------------- the service's own index */

test('the colour index the enquiry service ships matches the library', () => {
  // `server/colour-index.json` is generated from this file's library by
  // tools/build-colour-index.mjs. `/api/search/colours` reads it at runtime, and
  // the runtime container has no TypeScript sources to fall back on — so an index
  // that drifts from the library is a search endpoint quietly lying about the
  // range. `npm run build` regenerates it; this test proves it was.
  const raw = readFileSync(new URL('../../server/colour-index.json', import.meta.url), 'utf8')
  const index = JSON.parse(raw) as {
    count?: number
    colours?: Array<{ id: string; code: string; name: string; hex: string; family: string }>
  }
  const entries = index.colours ?? []
  assert.equal(entries.length, COLORS.length, `index has ${entries.length} colours, the library has ${COLORS.length}`)
  assert.equal(index.count, COLORS.length, 'the index count disagrees with its own contents')

  const library = new Map(COLORS.map((colour) => [colour.id, colour]))
  const seen = new Set<string>()
  for (const entry of entries) {
    const colour = library.get(entry.id)
    assert.ok(colour, `index carries ${entry.id}, which is not in the library`)
    assert.equal(entry.code, colour.code, `${entry.id} has the wrong code`)
    assert.equal(entry.name, colour.name, `${entry.id} has the wrong name`)
    assert.equal(entry.hex.toUpperCase(), colour.hex.toUpperCase(), `${entry.id} has the wrong hex`)
    assert.equal(entry.family, colour.family, `${entry.id} has the wrong family`)
    assert.ok(!seen.has(entry.id), `${entry.id} appears twice in the index`)
    seen.add(entry.id)
  }
  for (const colour of COLORS) {
    assert.ok(seen.has(colour.id), `${colour.id} is missing from the index — run tools/build-colour-index.mjs`)
  }
})

const total = passed
/* -------------------------------------------------------------------- legal */

test('there are three legal notices, with unique slugs, in reading order', () => {
  assert.equal(LEGAL_DOCS.length, 3)
  assert.equal(new Set(LEGAL_DOCS.map((doc) => doc.slug)).size, LEGAL_DOCS.length)
  assert.deepEqual(LEGAL_DOCS.map((doc) => doc.slug), ['privacy', 'terms', 'accessibility'])
})

test('every notice carries a revision date a reader can age', () => {
  for (const doc of LEGAL_DOCS) {
    assert.match(doc.updated, /^\d{4}-\d{2}-\d{2}$/, `${doc.slug} updated`)
    assert.ok(doc.title, `${doc.slug} title`)
    assert.ok(doc.intro.length > 40, `${doc.slug} intro`)
    assert.ok(doc.sections.length >= 3, `${doc.slug} needs at least three sections`)
  }
})

test('no section is a heading with nothing under it', () => {
  for (const doc of LEGAL_DOCS) {
    for (const section of doc.sections) {
      const where = `${doc.slug} / ${section.heading}`
      assert.ok(section.heading, 'section needs a heading')
      assert.ok(
        section.body.length > 0 || (section.list?.length ?? 0) > 0 || section.form !== undefined,
        `${where} is empty`,
      )
      for (const paragraph of section.body) {
        assert.ok(paragraph.trim().length > 20, `${where} has a stub paragraph`)
      }
    }
  }
})

test('the data-request form appears once, in the privacy notice', () => {
  // It is the only interactive section in any notice, and it is the one a reader
  // arrives at wanting to exercise a right. A second copy would be a second place
  // to keep the statutory wording in step.
  const forms = LEGAL_DOCS.flatMap((doc) =>
    doc.sections.filter((section) => section.form !== undefined).map((section) => `${doc.slug}/${section.form}`),
  )
  assert.deepEqual(forms, ['privacy/data-request'])
})

test('findLegalDoc resolves by slug and returns undefined for junk', () => {
  assert.equal(findLegalDoc('privacy')?.title, 'Privacy notice')
  assert.equal(findLegalDoc('terms')?.title, 'Terms of use')
  assert.equal(findLegalDoc('accessibility')?.title, 'Accessibility statement')
  assert.equal(findLegalDoc(''), undefined)
  assert.equal(findLegalDoc('Privacy'), undefined)
  assert.equal(findLegalDoc('cookies'), undefined)
})

console.log(`\n${total} passed${process.exitCode ? ' — with failures' : ''}`)
