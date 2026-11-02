/**
 * Decision-support engine for the practical tools (roadmap 11.02).
 *
 * Every function here is pure and covered by `scripts/advisor.test.ts`, because
 * a recommendation tool that cannot be tested is a recommendation tool nobody
 * can defend to a customer on the phone.
 *
 * Two rules shaped the design:
 *
 *  1. **Explainable, not scored in secret.** The finish finder is a weighted rule
 *     table, and every rule that fires contributes a sentence a human can read
 *     aloud. The alternative — a model or an opaque ranking — is roadmap 11.02.07,
 *     which is explicitly gated on validating its utility and safeguards first.
 *  2. **Nothing is claimed that the product data does not carry.** Coverage,
 *     coats, dry times and `claimsStatus` are read from `products.ts`. Where the
 *     honest answer is "paint cannot fix this", the tool says so and stops.
 */
import { PRODUCTS, findProduct, FINISH_SHEEN_LABEL, type Product } from '../data/products'
import {
  PREP_SITUATIONS,
  prepForCondition,
  type ConditionKey,
  type FinishAnswers,
  type PrepSituation,
} from '../data/tools'
import type { PaintColor } from '../data/colors'

/* ------------------------------------------------------------- finish finder */

export type Caution = { text: string; guideId?: string | undefined }

export type FinishAdvice = {
  /** The recommended topcoat, always a real product record. */
  topcoat: Product
  /** The runner-up, so a visitor who disagrees has somewhere to go. */
  alternative?: Product | undefined
  /** Alkali-resisting primer, when the substrate is plaster or masonry. */
  primer?: Product | undefined
  /** Screeding compound, when the surface has to be flattened first. */
  screed?: Product | undefined
  /**
   * Substrates the range does not prime — bare timber and bare steel need a
   * primer this catalogue does not carry, and saying so is the honest answer.
   */
  primerNote?: string | undefined
  coats: number
  coatsNote?: string | undefined
  sheenLabel: string
  reasons: string[]
  cautions: Caution[]
  prep: PrepSituation[]
  /** Set when the right advice is "fix the building first": no system is sold. */
  blocked?: { title: string; body: string; guideId: string }
}

type Rule = {
  when: (answers: FinishAnswers) => boolean
  product: string
  weight: number
  reason: string
}

/**
 * The rule table. Read top to bottom: surface rules carry the most weight
 * because a steel gate cannot be painted with an emulsion whatever the wear,
 * then wear, then the sheen the visitor asked for.
 */
const RULES: Rule[] = [
  // ---- surface
  {
    when: (a) => a.surface === 'interior-wall',
    product: 'matt',
    weight: 3,
    reason: 'Interior walls in bedrooms, lounges and offices are the matt line’s work: a flat film that hides the small imperfections in plaster.',
  },
  {
    when: (a) => a.surface === 'interior-wall',
    product: 'silk',
    weight: 1,
    reason: 'The same wall can take silk if it will be washed.',
  },
  {
    when: (a) => a.surface === 'ceiling-trim',
    product: 'matt',
    weight: 4,
    reason: 'Ceilings and cornices are almost always matt — a sheen overhead shows roller marks in raking light.',
  },
  {
    when: (a) => a.surface === 'kitchen-bath',
    product: 'silk',
    weight: 4,
    reason: 'Kitchens and bathrooms want the tighter film of the silk line: it wipes down without burnishing and shrugs off cooking steam.',
  },
  {
    when: (a) => a.surface === 'wood-metal',
    product: 'gloss',
    weight: 5,
    reason: 'Timber and steel that are handled or rained on need the hard, washable gloss film. An emulsion will not survive a gate.',
  },
  {
    when: (a) => a.surface === 'exterior',
    product: 'weathershield',
    weight: 5,
    reason: 'An exposed elevation needs the textured exterior coating: it bridges hairline cracks, sheds water and stays colour-stable under UV.',
  },
  {
    when: (a) => a.surface === 'new-plaster',
    product: 'matt',
    weight: 2,
    reason: 'New plaster is normally finished in matt for a first decoration; the primer underneath matters more than the sheen on top.',
  },
  {
    when: (a) => a.surface === 'new-plaster',
    product: 'silk',
    weight: 1,
    reason: 'Silk is possible on new plaster only once the surface has been screeded flat.',
  },

  // ---- wear
  {
    when: (a) => a.wear === 'heavy',
    product: 'silk',
    weight: 3,
    reason: 'Heavy wear — corridors, kitchens, children’s rooms, rentals — is exactly the case the silk line exists for.',
  },
  {
    when: (a) => a.wear === 'moderate',
    product: 'silk',
    weight: 1,
    reason: 'Moderate wear tips a wall that will be wiped towards silk.',
  },
  {
    when: (a) => a.wear === 'light',
    product: 'matt',
    weight: 1,
    reason: 'Light wear means nothing has to be scrubbed, so the flatter, deeper film wins.',
  },

  // ---- sheen
  {
    when: (a) => a.sheen === 'flat',
    product: 'matt',
    weight: 3,
    reason: 'You asked for a flat, quiet surface — that is matt, under 5% sheen.',
  },
  {
    when: (a) => a.sheen === 'soft',
    product: 'silk',
    weight: 3,
    reason: 'You asked for a soft sheen — that is silk, 10–15%, which also lifts light into a dark room.',
  },
  {
    // Split by surface on purpose. The gloss line is a solvent-borne coating for
    // joinery and metal: recommending it for a wall because somebody ticked
    // "hard gloss" would be a recommendation the caution underneath it argues
    // against. On a wall the honest answer is silk, plus the explanation.
    when: (a) => a.sheen === 'gloss' && a.surface === 'wood-metal',
    product: 'gloss',
    weight: 4,
    reason: 'You asked for a hard gloss on timber or metal — that is exactly what the synthetic gloss line is for.',
  },
  {
    when: (a) => a.sheen === 'gloss' && a.surface !== 'wood-metal',
    product: 'silk',
    weight: 4,
    reason: 'You asked for a hard gloss. This range has no gloss emulsion, so the closest film for a wall is silk — washable, 10–15% sheen, and it needs a genuinely flat surface.',
  },

  // ---- condition (adjusts the finish, not only the preparation)
  {
    when: (a) => a.condition === 'uneven',
    product: 'matt',
    weight: 2,
    reason: 'An uneven wall is more forgiving in a flat finish; silk shows every ripple left in the plaster.',
  },
  {
    when: (a) => a.condition === 'mould' && a.surface !== 'wood-metal',
    product: 'silk',
    weight: 1,
    reason: 'Both interior lines carry an anti-fungi additive; the tighter silk film is the one to choose where condensation is the cause.',
  },
]

/** Products that can be a topcoat for a wall — the recommendation candidates. */
const TOPCOAT_IDS = ['matt', 'silk', 'gloss', 'weathershield']

function score(answers: FinishAnswers): Array<{ product: Product; weight: number; reasons: string[] }> {
  const table = new Map<string, { product: Product; weight: number; reasons: string[] }>()
  for (const id of TOPCOAT_IDS) {
    const product = findProduct(id)
    if (product) table.set(id, { product, weight: 0, reasons: [] })
  }
  for (const rule of RULES) {
    if (!rule.when(answers)) continue
    const entry = table.get(rule.product)
    if (!entry) continue
    entry.weight += rule.weight
    entry.reasons.push(rule.reason)
  }
  return [...table.values()].sort((a, b) => b.weight - a.weight || a.product.id.localeCompare(b.product.id))
}

const PLASTER_SUBSTRATES = new Set(['interior-wall', 'ceiling-trim', 'kitchen-bath', 'exterior', 'new-plaster'])
const NEEDS_PRIMER: ConditionKey[] = ['new', 'flaking', 'chalky', 'uneven']

export function recommendFinish(answers: FinishAnswers): FinishAdvice {
  const ranked = score(answers)
  const cautions: Caution[] = []
  const prep = prepForCondition(answers.condition)

  // A damp wall is not a paint problem. Recommend nothing and say why — this is
  // the one answer where the honest response loses the sale.
  if (answers.condition === 'damp') {
    return {
      topcoat: ranked[0]?.product ?? (findProduct('matt') as Product),
      coats: 0,
      sheenLabel: '',
      reasons: [],
      prep,
      cautions: [],
      blocked: {
        title: 'Fix the water before you buy paint',
        body: 'A damp wall needs its source found and repaired, and the wall dried, before any coating goes on. No product in this range — or any other — stops rising damp, and a film applied over a wet wall blisters from behind. Work through the damp sequence, then come back and we will specify the finish.',
        guideId: 'damp-and-mould',
      },
    }
  }

  const best = ranked[0]
  const alternative = ranked.find((entry) => entry.weight > 0 && entry.product.id !== best.product.id)
  const topcoat = best.product
  const reasons = best.reasons.length
    ? best.reasons
    : ['Nothing in your answers points one way or the other, so this is the general-purpose interior finish.']

  const primer = NEEDS_PRIMER.includes(answers.condition) && PLASTER_SUBSTRATES.has(answers.surface)
    ? findProduct('primer')
    : undefined
  const screed = answers.condition === 'uneven' ? findProduct('screeding') : undefined

  if (answers.surface === 'wood-metal') {
    cautions.push({
      text: 'Bare timber and bare steel need a primer this range does not carry: a wood primer with the knots sealed, or a zinc-rich or red-oxide metal primer. Degrease steel with a solvent wipe first.',
      guideId: 'preparing-walls',
    })
  }
  if (answers.sheen === 'gloss' && answers.surface !== 'wood-metal') {
    cautions.push({
      text: 'Gloss is specified for joinery and metal, not for walls. On a wall the same sheen is achievable nowhere in this range — silk is the closest washable film, and it needs a genuinely flat surface.',
      guideId: 'matt-or-silk',
    })
  }
  if (topcoat.id === 'silk' && (answers.condition === 'uneven' || answers.condition === 'flaking')) {
    cautions.push({
      text: 'Silk shows every ripple in the plaster. On this surface, either screed it flat first or drop to matt — a silk finish over an uneven wall reads as a defect even when the paint is perfect.',
      guideId: 'matt-or-silk',
    })
  }
  if (answers.condition === 'mould') {
    cautions.push({
      text: 'Treat the mould and reduce the moisture first. The anti-fungi additive protects the paint film; it does not remove water from the room.',
      guideId: 'damp-and-mould',
    })
  }
  if (answers.condition === 'chalky') {
    cautions.push({
      text: 'Rub the surface: if pigment comes off on your hand, stabilise it and re-test before any finish coat. Painting over a chalky surface bonds to the powder, not the wall.',
      guideId: 'preparing-walls',
    })
  }
  if (answers.surface === 'exterior' || answers.condition === 'new') {
    cautions.push({
      text: 'Keep the coat out of rain for 24 hours, and do not paint a wall hot enough to be uncomfortable to touch — a hot substrate flash-dries a water-based coat before it can be laid off.',
      guideId: 'preparing-walls',
    })
  }

  const coatsNote =
    answers.condition === 'new' || answers.condition === 'chalky'
      ? 'Porous new or chalky plaster drinks the first coat. Budget for the coat count on the data sheet plus one, and never skip the primer.'
      : undefined

  return {
    topcoat,
    alternative: alternative?.product,
    primer,
    screed,
    primerNote: answers.surface === 'wood-metal' ? 'Wood or metal primer, appropriate to the substrate' : undefined,
    coats: topcoat.coatsRecommended,
    coatsNote,
    sheenLabel: FINISH_SHEEN_LABEL[topcoat.finish],
    reasons,
    cautions,
    prep,
  }
}

/* ------------------------------------------------------------- project board */

/**
 * One saved estimate, as the calculator writes it.
 *
 * Kept deliberately small: it has to survive a round trip through a URL, so
 * every field is something a painter can read back over the phone.
 */
export type SavedEstimate = {
  /** Stable id, so a saved estimate can be removed or replaced. */
  id: string
  productId: string
  /** What the visitor called the room — "Lounge", "Master bedroom". */
  label: string
  /** e.g. "2 × 20 L + 1 × 4 L" */
  packs: string
  litres: number
  unit: 'L' | 'kg'
  area: number
  coats: number
  savedAt: number
}

export const estimateProduct = (estimate: SavedEstimate): Product | undefined => findProduct(estimate.productId)

/* --------------------------------------------------------------- checklists */

export type ChecklistItem = {
  id: string
  label: string
  detail?: string | undefined
  to?: string | undefined
}

export type ChecklistGroup = {
  id: string
  title: string
  note?: string
  items: ChecklistItem[]
}

export type ChecklistInput = {
  projectName: string
  colours: PaintColor[]
  products: Product[]
  estimates: SavedEstimate[]
  prep: PrepSituation[]
}

/**
 * Turn a saved project into the order of work.
 *
 * The sequence is the one the guides publish — measure, confirm, prepare,
 * prime, coat, cure — not an invention of this function. Items only appear when
 * the project actually contains them, so an empty board produces an empty
 * checklist rather than a wall of generic advice.
 */
export function buildChecklist(input: ChecklistInput): ChecklistGroup[] {
  const { colours, products, estimates, prep } = input
  const groups: ChecklistGroup[] = []

  const before: ChecklistItem[] = []
  if (estimates.length || colours.length) {
    before.push({
      id: 'measure',
      label: 'Measure every room again on site',
      detail: 'The calculator works from the numbers you type. Confirm them against the wall before anyone buys paint.',
      to: '/calculator',
    })
  }
  if (colours.length) {
    before.push({
      id: 'sample',
      label: 'Confirm the colour against a real sample',
      detail: `${colours.length} colour${colours.length === 1 ? '' : 's'} on the board are digital proofs. Order a sample pot or ask a dealer for a chip, and look at it in the room at the time of day you use the room.`,
      to: '/quote?type=sample',
    })
  }
  if (prep.length) {
    before.push({
      id: 'survey',
      label: 'Walk the surface and confirm its condition',
      detail: prep.map((situation) => situation.label).join(' · '),
      to: '/tools/surface-prep',
    })
  } else if (products.length || estimates.length) {
    before.push({
      id: 'survey',
      label: 'Check what condition the walls are in',
      detail: 'New render, flaking, chalky, uneven or damp each need a different sequence before any finish coat.',
      to: '/tools/surface-prep',
    })
  }
  // Only when there is something to confirm: an empty project gets an empty
  // checklist rather than a wall of generic advice.
  if (estimates.length || colours.length || products.length || prep.length) {
    before.push({
      id: 'confirm-packs',
      label: 'Confirm pack sizes and availability with a dealer',
      detail: 'Stock varies by counter. Call ahead with the quantities below rather than travelling hopeful.',
      to: '/dealers',
    })
  }
  if (before.length) {
    groups.push({ id: 'before', title: 'Before you buy', items: before })
  }

  const buy: ChecklistItem[] = estimates.map((estimate) => {
    const product = estimateProduct(estimate)
    return {
      id: `buy-${estimate.id}`,
      label: `${estimate.packs} of ${product?.shortName ?? estimate.productId}`,
      detail: `${estimate.label} · ${estimate.area} m² · ${estimate.coats} coat${estimate.coats === 1 ? '' : 's'}${
        product ? ` · ${product.sku}` : ''
      }`,
      to: product ? `/products/${product.id}` : undefined,
    }
  })
  for (const product of products) {
    if (estimates.some((estimate) => estimate.productId === product.id)) continue
    buy.push({
      id: `buy-${product.id}`,
      label: product.name,
      detail: `${product.finish} · pack sizes ${product.packs.map((pack) => `${pack.size} ${pack.unit}`).join(', ')}`,
      to: `/products/${product.id}`,
    })
  }
  for (const situation of prep) {
    for (const id of situation.products) {
      const product = findProduct(id)
      if (!product) continue
      if (buy.some((item) => item.label.includes(product.shortName) || item.label === product.name)) continue
      buy.push({
        id: `buy-prep-${situation.id}-${product.id}`,
        label: product.name,
        detail: `Needed for ${situation.label.toLowerCase()}`,
        to: `/products/${product.id}`,
      })
    }
  }
  if (colours.length) {
    buy.push({
      id: 'buy-colours',
      label: `Colours: ${colours.map((colour) => `${colour.name} (${colour.code})`).join(', ')}`,
      detail: 'Quote the code, not the name — the code is what the fan deck and the dealer use.',
      to: '/colours',
    })
  }
  if (buy.length) {
    groups.push({
      id: 'buy',
      title: 'What to buy',
      note: 'Pricing is not published on this site: send this list to a dealer or to the colour desk and they will quote against real stock.',
      items: buy,
    })
  }

  const prepare: ChecklistItem[] = []
  for (const situation of prep) {
    for (const [index, step] of situation.steps.entries()) {
      prepare.push({
        id: `prep-${situation.id}-${index}`,
        label: `${situation.label}: ${step.step}`,
        detail: step.detail,
      })
    }
    for (const warning of situation.warnings) {
      prepare.push({ id: `warn-${situation.id}-${warning.slice(0, 12)}`, label: `⚠ ${warning}` })
    }
  }
  if (prepare.length) {
    groups.push({ id: 'prepare', title: 'Prepare the surface', items: prepare })
  }

  const paint: ChecklistItem[] = []
  for (const product of products) {
    for (const [index, step] of product.application.entries()) {
      paint.push({
        id: `apply-${product.id}-${index}`,
        label: `${product.shortName}: ${step.step}`,
        detail: `${step.detail} Touch dry ${product.touchDryHours} h · recoat ${product.recoatHours} h.`,
        to: `/products/${product.id}`,
      })
    }
  }
  if (paint.length) {
    groups.push({
      id: 'paint',
      title: 'Apply',
      note: 'Steps and intervals are transcribed from the product data sheet. In the rainy season, humidity can double the recoat time.',
      items: paint,
    })
  }

  const after: ChecklistItem[] = []
  for (const product of products) {
    if (product.fullCureDays) {
      after.push({
        id: `cure-${product.id}`,
        label: `Let ${product.shortName} cure for ${product.fullCureDays} days`,
        detail: 'Do not wash or scrub the film before it has cured.',
      })
    }
    if (product.guaranteeYears) {
      after.push({
        id: `guarantee-${product.id}`,
        label: `Keep the till slip — ${product.guaranteeYears}-year guarantee`,
        detail: 'The guarantee on this product is under the terms printed on the pail.',
        to: `/products/${product.id}`,
      })
    }
  }
  if (estimates.length) {
    after.push({
      id: 'leftovers',
      label: 'Store the surplus properly',
      detail: 'Decant into a smaller, sealed container, label it with the colour code and the room, and keep it for touch-ups.',
    })
  }
  if (after.length) {
    groups.push({ id: 'after', title: 'After the last coat', items: after })
  }

  return groups
}

/** Plain-text rendering of a checklist — the clipboard and download export. */
export function checklistToText(projectName: string, groups: ChecklistGroup[]): string {
  const lines: string[] = [`OPUDA’S PAINT — ${projectName || 'My project'}`, '']
  for (const group of groups) {
    lines.push(group.title.toUpperCase())
    if (group.note) lines.push(group.note)
    for (const item of group.items) {
      lines.push(`[ ] ${item.label}`)
      if (item.detail) lines.push(`    ${item.detail}`)
    }
    lines.push('')
  }
  lines.push('Colours on screen are digital proofs. Confirm with a sample pot or a dealer chip.')
  return lines.join('\n')
}

export const prepByIds = (ids: string[]): PrepSituation[] =>
  ids.map((id) => PREP_SITUATIONS.find((situation) => situation.id === id)).filter((found): found is PrepSituation => Boolean(found))

export const ALL_PRODUCTS = PRODUCTS
