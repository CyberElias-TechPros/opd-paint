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

import { COLORS, findColor } from '../src/data/colors.ts'
import { PALETTES, findPalette } from '../src/data/palettes.ts'
import { PRODUCTS, findProduct } from '../src/data/products.ts'
import { DEALERS, STATES, directionsUrl, distanceKm } from '../src/data/dealers.ts'
import { GUIDES, findGuide } from '../src/data/guides.ts'
import { PROJECTS } from '../src/data/projects.ts'
import { INK, PAPER, contrast, estimateLrv, readableInk, swatchText } from '../src/lib/color.ts'
import { ALT } from '../src/lib/media.ts'
import { PREP_CONDITIONS } from '../src/data/surfacePrep.ts'
import { orderProductsForWork } from '../src/lib/projectChecklist.ts'

let passed = 0
const test = (name, fn) => {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}`)
    console.error(error.message)
    process.exitCode = 1
  }
}

const manifest = JSON.parse(
  readFileSync(new URL('../public/media/manifest.json', import.meta.url), 'utf8'),
)
const mediaKeys = new Set(Object.keys(manifest.images ?? manifest))
const HEX = /^#[0-9A-F]{6}$/

console.log('content integrity')

/* ------------------------------------------------------------------ colours */

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
  const families = new Set(COLORS.map((c) => c.family))
  for (const family of [
    'White & Off-White',
    'Warm Neutral',
    'Green',
    'Blue',
    'Terracotta & Red',
    'Yellow & Ochre',
    'Purple & Mauve',
    'Grey',
    'Deep & Architectural',
  ]) {
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

test('every surface-prep condition points at real products and a real guide', () => {
  for (const condition of PREP_CONDITIONS) {
    assert.ok(condition.steps.length >= 3, `${condition.id} has fewer than three steps`)
    assert.ok(findGuide(condition.relatedGuide), `${condition.id} points at an unknown guide`)
    for (const productId of condition.relatedProducts) {
      assert.ok(findProduct(productId), `${condition.id} recommends an unknown product "${productId}"`)
    }
  }
})

test('surface-prep condition ids are unique', () => {
  const ids = PREP_CONDITIONS.map((c) => c.id)
  assert.deepEqual(ids, [...new Set(ids)], 'duplicate surface-prep condition id')
})

test('the project checklist orders preparation before topcoats, and topcoats before trim', () => {
  const screeding = findProduct('screeding')
  const primer = findProduct('primer')
  const matt = findProduct('matt')
  const gloss = findProduct('gloss')
  const ordered = orderProductsForWork([gloss, matt, screeding, primer])
  assert.deepEqual(
    ordered.map((p) => p.id),
    ['screeding', 'primer', 'matt', 'gloss'],
  )
})

const total = passed
console.log(`\n${total} passed${process.exitCode ? ' — with failures' : ''}`)
