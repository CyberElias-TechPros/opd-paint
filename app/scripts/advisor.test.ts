/**
 * Advisor, share-link and tools-data tests — run with `npm test`.
 *
 * The practical tools (roadmap 11.02) give advice. Advice that cannot be tested
 * is advice nobody can defend on the phone, so every rule with a consequence is
 * pinned here:
 *
 *   • the finish finder recommends real products, says why, and refuses to sell
 *     a system for a wall that has a damp problem;
 *   • the checklist it produces links only to routes this app owns, and says
 *     "digital proofs" wherever a colour appears — the honesty rule the content
 *     tests enforce everywhere else;
 *   • a shared project survives a round trip through a URL, and a tampered or
 *     truncated token is rejected rather than half-rendered;
 *   • every id in `data/tools.ts` points at a product or a guide that exists.
 *
 * That last one is the check `src/data/tools.ts` promises in its header comment:
 * the preparation sequences cite product ids and guide ids by hand, and a rename
 * in either file would otherwise leave a dead link on a page nobody re-reads.
 *
 * Node strips the types natively; no test framework is needed for pure modules.
 */
import assert from 'node:assert/strict'

import {
  buildChecklist,
  checklistToText,
  estimateProduct,
  prepByIds,
  recommendFinish,
  type SavedEstimate,
} from '../src/lib/advisor.ts'
import { decodeProject, encodeProject, projectUrl, SHARE_PARAM } from '../src/lib/share.ts'
import {
  CONDITION_OPTIONS,
  FINISH_QUESTIONS,
  OPTIONS_FOR,
  PREP_SITUATIONS,
  SHEEN_OPTIONS,
  SURFACE_OPTIONS,
  TOOL_CARDS,
  WEAR_OPTIONS,
  findPrepSituation,
  prepForCondition,
  type ConditionKey,
  type FinishAnswers,
} from '../src/data/tools.ts'
import { PRODUCTS, findProduct, FINISH_SHEEN_LABEL } from '../src/data/products.ts'
import { GUIDES } from '../src/data/guides.ts'
import { COLORS, findColor } from '../src/data/colors.ts'

let passed = 0
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

console.log('finish finder')

/** A complete, valid set of answers — each test changes one field. */
const answers = (over: Partial<FinishAnswers> = {}): FinishAnswers => ({
  surface: 'interior-wall',
  condition: 'sound',
  wear: 'moderate',
  sheen: 'soft',
  ...over,
})

const GUIDE_IDS = new Set(GUIDES.map((guide) => guide.id))
const PRODUCT_IDS = new Set(PRODUCTS.map((product) => product.id))

test('every answer set recommends a real product, with the coats the data sheet gives', () => {
  for (const surface of SURFACE_OPTIONS) {
    for (const condition of CONDITION_OPTIONS) {
      for (const wear of WEAR_OPTIONS) {
        for (const sheen of SHEEN_OPTIONS) {
          const advice = recommendFinish(answers({
            surface: surface.id,
            condition: condition.id,
            wear: wear.id,
            sheen: sheen.id,
          }))
          assert.ok(advice.topcoat, `${surface.id}/${condition.id}/${wear.id}/${sheen.id} recommended nothing`)
          assert.ok(PRODUCT_IDS.has(advice.topcoat.id), `recommended an unknown product ${advice.topcoat.id}`)
          if (advice.blocked) {
            // A blocked answer sells nothing: no coat count, no sheen, no reasons.
            assert.equal(advice.coats, 0)
            assert.equal(advice.reasons.length, 0)
            assert.ok(GUIDE_IDS.has(advice.blocked.guideId), `blocked answer cites unknown guide ${advice.blocked.guideId}`)
          } else {
            assert.equal(advice.coats, advice.topcoat.coatsRecommended, 'coat count is the product’s own, not an invention')
            assert.equal(advice.sheenLabel, FINISH_SHEEN_LABEL[advice.topcoat.finish])
            assert.ok(advice.reasons.length, 'a recommendation without a reason cannot be defended')
          }
          for (const caution of advice.cautions) {
            if (caution.guideId) assert.ok(GUIDE_IDS.has(caution.guideId), `caution cites unknown guide ${caution.guideId}`)
          }
          for (const situation of advice.prep) {
            assert.ok(findPrepSituation(situation.id), `prep situation ${situation.id} does not exist`)
          }
        }
      }
    }
  }
})

test('a damp wall is refused rather than sold to', () => {
  const advice = recommendFinish(answers({ condition: 'damp' }))
  assert.ok(advice.blocked, 'damp must block the recommendation')
  assert.match(advice.blocked.body, /damp/i)
  assert.equal(advice.blocked.guideId, 'damp-and-mould')
  assert.ok(GUIDE_IDS.has('damp-and-mould'), 'the guide the damp answer sends you to must exist')
  assert.equal(advice.coats, 0, 'a blocked answer quotes no coat count')
})

test('new plaster gets an alkali-resisting primer and a warning about porosity', () => {
  const advice = recommendFinish(answers({ condition: 'new', surface: 'interior-wall' }))
  assert.equal(advice.primer?.id, 'primer')
  assert.ok(advice.coatsNote, 'porous new plaster needs the coat-count caveat')
  assert.match(advice.coatsNote, /primer/i)
})

test('an uneven surface gets screeding compound before any finish', () => {
  const advice = recommendFinish(answers({ condition: 'uneven' }))
  assert.equal(advice.screed?.id, 'screeding')
  assert.ok(advice.prep.some((situation) => situation.id === 'uneven'), 'the prep sequence for uneven walls is attached')
})

test('bare wood and metal are told the truth: this range has no primer for them', () => {
  const advice = recommendFinish(answers({ surface: 'wood-metal', sheen: 'gloss' }))
  assert.equal(advice.primer, undefined, 'the plaster primer must not be recommended for timber or steel')
  assert.ok(advice.primerNote, 'the visitor is told what primer they do need')
  assert.match(advice.primerNote, /wood|metal/i)
  assert.ok(
    advice.cautions.some((caution) => /zinc-rich|red-oxide|wood primer/i.test(caution.text)),
    'the caution names the primer types the range does not carry',
  )
})

test('an exterior wall is answered with the exterior coating', () => {
  const advice = recommendFinish(answers({ surface: 'exterior', sheen: 'flat' }))
  assert.equal(advice.topcoat.id, 'weathershield')
  assert.ok(
    advice.cautions.some((caution) => /rain/i.test(caution.text)),
    'exterior work carries the weather caution',
  )
})

test('gloss on a wall is challenged rather than quietly supplied', () => {
  for (const surface of ['interior-wall', 'ceiling-trim', 'kitchen-bath', 'new-plaster'] as const) {
    const advice = recommendFinish(answers({ surface, sheen: 'gloss' }))
    assert.ok(
      advice.cautions.some((caution) => /gloss is specified for joinery/i.test(caution.text)),
      `${surface} asked for gloss and was not told gloss is for joinery and metal`,
    )
    assert.notEqual(advice.topcoat.id, 'gloss', `${surface} was sold a solvent-borne gloss`)
    assert.ok(advice.reasons.some((reason) => /no gloss emulsion/i.test(reason)), `${surface} is not told why`)
  }
})

test('gloss on joinery and metal is supplied, not argued with', () => {
  const advice = recommendFinish(answers({ surface: 'wood-metal', sheen: 'gloss', wear: 'heavy' }))
  assert.equal(advice.topcoat.id, 'gloss')
  assert.ok(!advice.cautions.some((caution) => /gloss is specified for joinery/i.test(caution.text)),
    'the caution is for walls, not for the surface gloss is made for')
})

test('the alternative is a different product, so disagreeing has somewhere to go', () => {
  const advice = recommendFinish(answers())
  if (advice.alternative) assert.notEqual(advice.alternative.id, advice.topcoat.id)
})

test('mould is treated before it is painted, and the tool says so', () => {
  const advice = recommendFinish(answers({ condition: 'mould' }))
  assert.ok(advice.cautions.some((caution) => /treat the mould/i.test(caution.text)))
  assert.ok(advice.prep.some((situation) => situation.id === 'mould'))
})

console.log('\nsurface preparation data')

test('every preparation situation cites products and guides that exist', () => {
  for (const situation of PREP_SITUATIONS) {
    for (const id of situation.products) {
      assert.ok(PRODUCT_IDS.has(id), `${situation.id} cites unknown product ${id}`)
    }
    for (const id of situation.guides) {
      assert.ok(GUIDE_IDS.has(id), `${situation.id} cites unknown guide ${id}`)
    }
    assert.ok(situation.steps.length >= 3, `${situation.id} has too few steps to be a sequence`)
    for (const step of situation.steps) {
      assert.ok(step.step.trim().length >= 3, `${situation.id} has an empty step label`)
      assert.ok(step.detail.trim().length >= 20, `${situation.id} step "${step.step}" explains nothing`)
    }
    assert.ok(situation.signs.length >= 2, `${situation.id} cannot be recognised from its signs`)
    assert.ok(situation.surfaces.length >= 1, `${situation.id} says where it does not occur`)
    assert.ok(situation.id === situation.id.trim(), `${situation.id} has stray whitespace in its id`)
  }
})

test('preparation ids are unique and addressable', () => {
  const ids = PREP_SITUATIONS.map((situation) => situation.id)
  assert.equal(new Set(ids).size, ids.length, 'two situations share an id')
  for (const id of ids) assert.equal(findPrepSituation(id)?.id, id)
  assert.equal(findPrepSituation('not-a-situation'), undefined)
  assert.deepEqual(prepByIds(['flaking', 'nope', 'coastal']).map((s) => s.id), ['flaking', 'coastal'],
    'an unknown id is dropped rather than rendered as undefined')
})

test('every condition answer has a preparation sequence behind it', () => {
  for (const option of CONDITION_OPTIONS) {
    const sequences = prepForCondition(option.id as ConditionKey)
    assert.ok(sequences.length, `condition ${option.id} produced no preparation sequence`)
    for (const sequence of sequences) {
      assert.ok(PREP_SITUATIONS.includes(sequence), `condition ${option.id} returned a situation that is not in the data`)
    }
  }
})

test('the finish questions and their options line up', () => {
  assert.equal(FINISH_QUESTIONS.length, 4, 'the finder promises four questions')
  const asked = new Set<string>()
  for (const question of FINISH_QUESTIONS) {
    assert.ok(!asked.has(question.id), `two questions share the id ${question.id}`)
    asked.add(question.id)
    const options = OPTIONS_FOR[question.id]
    assert.ok(options?.length, `question ${question.id} has no options`)
    const ids = options.map((option) => option.id)
    assert.equal(new Set(ids).size, ids.length, `question ${question.id} has duplicate option ids`)
    assert.ok(question.prompt.trim().length > 8, `question ${question.id} has no prompt`)
    assert.ok(question.why.trim().length > 20, `question ${question.id} does not explain why it is asked`)
    assert.match(question.step, /^0\d$/, `question ${question.id} has no step number`)
  }
  assert.deepEqual([...asked].sort(), ['condition', 'sheen', 'surface', 'wear'], 'the four answers the engine reads')
})

test('the tool hub links only to routes this app owns', () => {
  const owned = ['/tools', '/tools/finish-finder', '/tools/surface-prep', '/calculator', '/project', '/room-preview', '/colours', '/quote']
  const ids = TOOL_CARDS.map((card) => card.id)
  assert.equal(new Set(ids).size, ids.length, 'two tools share an id')
  for (const card of TOOL_CARDS) {
    assert.ok(owned.includes(card.to), `${card.id} links to ${card.to}, which is not a route`)
    assert.ok(card.roadmap.length, `${card.id} claims no roadmap task, so its scope cannot be checked`)
    for (const task of card.roadmap) {
      assert.match(task, /^\d{2}\.\d{2}/, `${card.id} cites "${task}", which is not a roadmap task id`)
    }
  }
})

console.log('\nproject checklist')

const lounge: SavedEstimate = {
  id: 'matt-1',
  productId: 'matt',
  label: 'Lounge',
  packs: '2 × 20 L',
  litres: 34,
  unit: 'L',
  area: 148,
  coats: 2,
  savedAt: Date.now(),
}

test('an empty project produces an empty checklist', () => {
  const groups = buildChecklist({ projectName: 'Nothing yet', colours: [], products: [], estimates: [], prep: [] })
  assert.deepEqual(groups, [], 'generic advice is not a checklist')
})

test('a saved estimate becomes a line to buy, linked to the product page', () => {
  const groups = buildChecklist({
    projectName: 'The flat',
    colours: [],
    products: [],
    estimates: [lounge],
    prep: [],
  })
  const buy = groups.find((group) => group.id === 'buy')
  assert.ok(buy, 'there is a "what to buy" group')
  const line = buy.items.find((item) => item.id === `buy-${lounge.id}`)
  assert.ok(line, 'the estimate is on the list')
  assert.match(line.label, /2 × 20 L/)
  assert.match(line.label, /Matt/, 'the line names the product a painter would ask for')
  assert.equal(line.to, '/products/matt')
  assert.match(line.detail ?? '', /Lounge · 148 m² · 2 coats/)
  assert.match(buy.note ?? '', /Pricing is not published/, 'the list does not imply a price')
})

test('a colour on the checklist is labelled a digital proof', () => {
  const colour = findColor(COLORS[0].id)
  assert.ok(colour)
  const groups = buildChecklist({ projectName: 'Test', colours: [colour], products: [], estimates: [], prep: [] })
  const text = checklistToText('Test', groups)
  assert.match(text, /digital proof/i, 'the checklist repeats the honesty rule wherever a colour appears')
  assert.match(text, new RegExp(colour.code), 'the code is what a dealer can look up')
  const sample = groups.flatMap((group) => group.items).find((item) => item.id === 'sample')
  assert.ok(sample, 'confirming against a real sample is a step, not a footnote')
  assert.equal(sample.to, '/quote?type=sample')
})

test('every checklist link points at a route this app owns', () => {
  const owned = ['/calculator', '/quote', '/dealers', '/tools/surface-prep', '/products', '/colours', '/advice', '/project']
  const groups = buildChecklist({
    projectName: 'Everything',
    colours: [findColor(COLORS[0].id)!],
    products: [findProduct('matt')!, findProduct('primer')!],
    estimates: [lounge],
    prep: prepByIds(['new-render', 'flaking']),
  })
  const items = groups.flatMap((group) => group.items)
  assert.ok(items.length > 8, 'a full project produces a real checklist')
  for (const item of items) {
    if (!item.to) continue
    assert.ok(
      owned.some((prefix) => item.to === prefix || item.to?.startsWith(`${prefix}/`) || item.to?.startsWith(`${prefix}?`)),
      `checklist item "${item.label}" links to ${item.to}, which is not a route`,
    )
  }
  const ids = items.map((item) => item.id)
  assert.equal(new Set(ids).size, ids.length, 'two checklist items share an id, so one cannot be ticked off')
})

test('preparation sequences and product application steps appear in order of work', () => {
  const groups = buildChecklist({
    projectName: 'New build',
    colours: [],
    products: [findProduct('matt')!],
    estimates: [],
    prep: prepByIds(['new-render']),
  })
  const order = groups.map((group) => group.id)
  assert.deepEqual(order, ['before', 'buy', 'prepare', 'paint', 'after'], 'the sequence is measure, buy, prepare, apply, cure')
  const prepare = groups.find((group) => group.id === 'prepare')!
  assert.match(prepare.items[0].label, /New render or blockwork: Let it cure/)
  assert.ok(prepare.items.some((item) => item.label.startsWith('⚠')), 'the hard stop is on the list, not hidden in a footnote')
})

test('the text export is readable by a person and by a dealer on WhatsApp', () => {
  const groups = buildChecklist({
    projectName: 'Ikoyi flat',
    colours: [findColor(COLORS[0].id)!],
    products: [findProduct('matt')!],
    estimates: [lounge],
    prep: prepByIds(['sound-repaint']),
  })
  const text = checklistToText('Ikoyi flat', groups)
  assert.match(text, /OPUDA’S PAINT — Ikoyi flat/)
  assert.match(text, /\[ \] /, 'each step is a checkbox somebody can tick')
  assert.match(text, /BEFORE YOU BUY/)
  assert.match(text, /WHAT TO BUY/)
  assert.ok(!text.includes('undefined'), 'no field leaked into the export')
  assert.ok(!text.includes('[object Object]'))
})

test('an estimate for a product that no longer exists degrades instead of breaking', () => {
  const orphan: SavedEstimate = { ...lounge, id: 'gone-1', productId: 'discontinued-product' }
  assert.equal(estimateProduct(orphan), undefined)
  const groups = buildChecklist({ projectName: 'Old board', colours: [], products: [], estimates: [orphan], prep: [] })
  const line = groups.flatMap((group) => group.items).find((item) => item.id === `buy-${orphan.id}`)
  assert.ok(line, 'the visitor still sees what they saved')
  assert.equal(line.to, undefined, 'and it links nowhere rather than to a 404')
})

console.log('\nshare links')

test('a project survives a round trip through a URL', () => {
  const project = {
    name: 'Renovation — Ikoyi',
    colours: COLORS.slice(0, 4).map((colour) => colour.id),
    products: ['matt', 'primer'],
    estimates: [lounge],
    prep: ['new-render', 'coastal'],
  }
  const token = encodeProject(project)
  const decoded = decodeProject(token)
  assert.ok(decoded)
  assert.equal(decoded.name, project.name)
  assert.deepEqual(decoded.colours, project.colours)
  assert.deepEqual(decoded.products, project.products)
  assert.deepEqual(decoded.prep, project.prep)
  assert.equal(decoded.estimates.length, 1)
  assert.equal(decoded.estimates[0].packs, '2 × 20 L')
  assert.equal(decoded.estimates[0].unit, 'L')
  assert.equal(decoded.estimates[0].area, 148)
})

test('the token is URL-safe, so it survives being pasted into WhatsApp', () => {
  const token = encodeProject({
    name: 'A name with spaces, commas & symbols — 100% tested?',
    colours: COLORS.slice(0, 6).map((colour) => colour.id),
    products: PRODUCTS.map((product) => product.id),
    estimates: [lounge, { ...lounge, id: 'silk-1', productId: 'silk', label: 'Ceiling' }],
    prep: PREP_SITUATIONS.map((situation) => situation.id),
  })
  assert.ok(!/[+/=\s]/.test(token), 'base64url only: no padding, no slash, no plus, no space')
  assert.ok(token.length < 1800, `the link stays inside a comfortable length (${token.length} chars)`)
  const url = projectUrl({
    name: 'x',
    colours: [],
    products: [],
    estimates: [],
    prep: [],
  }, 'https://www.opudapaint.com')
  assert.ok(url.startsWith(`https://www.opudapaint.com/project?${SHARE_PARAM}=`), url)
})

test('a token that is not a project is rejected rather than half-rendered', () => {
  assert.equal(decodeProject(null), null)
  assert.equal(decodeProject(''), null)
  assert.equal(decodeProject('not-base64url-###'), null)
  assert.equal(decodeProject(btoa(JSON.stringify({ nope: true }))), null)
  assert.equal(decodeProject(btoa('a string, not json')), null)
  assert.equal(decodeProject(btoa(JSON.stringify({ name: 42, colours: 'not-an-array' }))), null)
})

test('an id the app cannot resolve never reaches the link, in either direction', () => {
  const token = encodeProject({
    name: 'Mixed',
    colours: [COLORS[0].id, 'a-colour-that-does-not-exist'],
    products: ['matt', 'not-a-product'],
    estimates: [lounge],
    prep: ['new-render', 'not-a-situation'],
  })
  const decoded = decodeProject(token)
  assert.ok(decoded)
  // Dropped on the way out and filtered again on the way in: a colour retired
  // from the library after a link was shared cannot render as "undefined", and
  // a hand-edited token cannot smuggle an id into a page.
  assert.deepEqual(decoded.colours, [COLORS[0].id])
  assert.deepEqual(decoded.products, ['matt'])
  assert.deepEqual(prepByIds(decoded.prep).map((situation) => situation.id), ['new-render'])
  assert.deepEqual(
    decodeProject(
      // A valid envelope carrying an id that does not exist.
      btoa(JSON.stringify({ v: 1, n: 'Tampered', c: ['not-a-colour'], p: [], s: [], e: [] })),
    ),
    null,
    'a token with nothing resolvable in it is not a project',
  )
})

test('a name longer than the field allows is truncated, not rejected', () => {
  const decoded = decodeProject(
    encodeProject({ name: 'x'.repeat(400), colours: [COLORS[0].id], products: [], estimates: [], prep: [] }),
  )
  assert.ok(decoded)
  assert.ok(decoded.name.length <= 60, `name came back ${decoded.name.length} characters long`)
})

test('a link with nothing in it is not a project', () => {
  // Somebody can paste `?s=` with an empty payload; the page has to say the link
  // is not valid rather than render a board with a name and no contents.
  assert.equal(decodeProject(encodeProject({ name: 'Empty', colours: [], products: [], estimates: [], prep: [] })), null)
})

test('an estimate for a retired product is dropped from a shared link', () => {
  const token = btoa(
    JSON.stringify({
      v: 1,
      n: 'Old board',
      c: [COLORS[0].id],
      p: [],
      s: [],
      e: [['id-1', 'product-we-no-longer-make', 'Lounge', '2 × 20 L', 34, 'L', 148, 2]],
    }),
  )
  const decoded = decodeProject(token)
  assert.ok(decoded)
  assert.deepEqual(decoded.estimates, [], 'the quantity is dropped rather than shown against the wrong product')
})

test('an estimate with an impossible number is dropped', () => {
  const token = btoa(
    JSON.stringify({
      v: 1,
      n: 'Hostile',
      c: [COLORS[0].id],
      p: [],
      s: [],
      e: [
        ['a', 'matt', 'Lounge', '2 × 20 L', Number.NaN, 'L', 148, 2],
        ['b', 'matt', 'Lounge', '2 × 20 L', 34, 'L', -900, 2],
        ['c', 'matt', 'Lounge', '2 × 20 L', 34, 'L', 148, 99],
      ],
    }),
  )
  const decoded = decodeProject(token)
  assert.ok(decoded)
  assert.deepEqual(decoded.estimates, [], 'no amount, area or coat count survives being out of range')
})

console.log(`\n${passed} passed${process.exitCode ? ', failures above' : ''}`)
