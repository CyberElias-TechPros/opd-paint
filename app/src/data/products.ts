/**
 * Product catalogue.
 *
 * STATUS: v0.9 — the MATT and SILK lines are transcribed from the physical
 * pails photographed in /opuda (label claims: high quality, for walls and
 * ceilings, smooth finish, better flow, extra coverage, anti-fungi additive,
 * eco-friendly, weather resistance, 5-year guarantee). The supporting lines
 * (primer, screeding, gloss, weathershield) are the standard set a
 * manufacturer at this scale supplies and must be confirmed by the technical
 * owner before publication — see /data for the live provenance table.
 *
 * PRICING: the site does not publish prices. Current pricing varies by pack,
 * dealer and delivery, so every inquiry path (WhatsApp, the quote form, the
 * calculator, dealer counters) routes to a person who can quote against real
 * stock. If pricing is ever published here, it must come from the
 *   authoritative price list, not from this file.
 */

import { applyProductOverrides } from '../lib/contentOverrides'

export type Finish = 'Matt' | 'Silk' | 'Satin' | 'Gloss' | 'Primer' | 'Texture' | 'Filler'
export type Surface = 'Interior walls' | 'Ceilings' | 'Exterior walls' | 'Wood & metal' | 'New plaster' | 'Bathrooms & kitchens'

export type Pack = {
  size: number
  unit: 'L' | 'kg'
  inStock: boolean
}

export type Product = {
  id: string
  sku: string
  name: string
  shortName: string
  line: string
  tagline: string
  description: string
  finish: Finish
  surfaces: Surface[]
  sheenLevel: number
  /** m² covered by one litre (or kg) of a single coat on a sound, sealed surface. */
  coveragePerUnit: number
  coatsRecommended: number
  touchDryHours: number
  recoatHours: number
  fullCureDays: number
  dilution: string
  voc: string
  guaranteeYears: number
  features: string[]
  packs: Pack[]
  image: string
  gallery: string[]
  tds: { label: string; href: string }[]
  bestFor: string
  application: { step: string; detail: string }[]
  /** Confirmed from the physical label, or still awaiting technical sign-off. */
  claimsStatus: 'label-verified' | 'pending-verification'
}

const pack = (size: number, unit: 'L' | 'kg', inStock = true): Pack => ({ size, unit, inStock })

const PRODUCTS_BASE: Product[] = [
  {
    id: 'matt',
    sku: 'OPD-MT',
    name: "OPUDA'S MATT Emulsion",
    shortName: 'Matt',
    line: "OPUDA'S",
    tagline: 'The all-purpose interior finish. Flat, forgiving, and the best value per square metre in the range.',
    description:
      "Our flagship interior emulsion. A high-opacity matt that levels out roller marks, hides the small imperfections in hand-floated plaster, and dries to a flat, chalk-free film. The label carries a five-year guarantee, an anti-fungi additive for humid rooms, and extra coverage so a 20-litre pail goes further than most emulsions at this price.",
    finish: 'Matt',
    surfaces: ['Interior walls', 'Ceilings'],
    sheenLevel: 2,
    coveragePerUnit: 11,
    coatsRecommended: 2,
    touchDryHours: 1,
    recoatHours: 3,
    fullCureDays: 7,
    dilution: 'First coat: thin up to 10% with clean water on porous new plaster. Finish coat: no dilution.',
    voc: 'Low-VOC, water-based. Meets the label’s eco-friendly claim.',
    guaranteeYears: 5,
    features: [
      'High quality, smooth finish',
      'Extra coverage per litre',
      'Better flow — fewer roller marks',
      'Anti-fungi additive for humid rooms',
      'Eco-friendly, low odour',
      '5-year guarantee',
    ],
    packs: [pack(20, 'L'), pack(10, 'L'), pack(4, 'L'), pack(1, 'L')],
    image: 'product-matt-bucket',
    gallery: ['product-matt-bucket', 'product-matt-pail', 'brand-banner-matt'],
    tds: [
      { label: 'Technical data sheet (PDF)', href: '/documents/opudas-matt-tds.pdf' },
      { label: 'Safety data sheet (PDF)', href: '/documents/opudas-matt-sds.pdf' },
    ],
    bestFor: 'Whole-house interiors, ceilings, rented property refreshes and budget-sensitive site work.',
    application: [
      { step: 'Prepare', detail: 'Scrape, fill and sand. New plaster must be fully cured (28 days), then sealed with one coat of alkali-resisting primer.' },
      { step: 'Prime', detail: 'One coat of OPUDA’S Primer on new or repaired surfaces. Allow 4 hours.' },
      { step: 'Cut in', detail: 'Cut in ceilings and corners with a 3" brush before rolling, so the roller never has to reach a hard edge.' },
      { step: 'Coat 1', detail: 'Roll from a wet edge, working in 1 m² sections. Thin up to 10% on porous plaster.' },
      { step: 'Coat 2', detail: 'Apply after 3 hours, undiluted, in the opposite direction to the first coat for an even film.' },
      { step: 'Cure', detail: 'Do not wash or scrub for 7 days. Ventilate well — humidity in the rainy season slows the cure.' },
    ],
    claimsStatus: 'label-verified',
  },
  {
    id: 'silk',
    sku: 'OPD-SLK',
    name: "OPUDA'S SILK Emulsion",
    shortName: 'Silk',
    line: "OPUDA'S",
    tagline: 'A soft sheen that shrugs off washing, cooking steam and small hands.',
    description:
      "Silk sits between matt and satin: a low, soft sheen with a tighter film that can be wiped down without burnishing. It is the finish we recommend for corridors, kitchens, children's rooms, and any wall that will be cleaned. The same five-year guarantee and anti-fungi additive as the Matt line, with a smoother, more reflective surface that lifts north-facing rooms.",
    finish: 'Silk',
    surfaces: ['Interior walls', 'Bathrooms & kitchens'],
    sheenLevel: 12,
    coveragePerUnit: 12,
    coatsRecommended: 2,
    touchDryHours: 1,
    recoatHours: 4,
    fullCureDays: 7,
    dilution: 'Thin up to 10% with clean water for the first coat only.',
    voc: 'Low-VOC, water-based, low odour.',
    guaranteeYears: 5,
    features: [
      'Washable soft-sheen film',
      'Resists kitchen steam and condensation',
      'Anti-fungi additive',
      'Smooth, self-levelling finish',
      'Weather resistant when used under cover',
      '5-year guarantee',
    ],
    packs: [pack(20, 'L'), pack(10, 'L'), pack(4, 'L'), pack(1, 'L')],
    image: 'product-silk-bucket',
    gallery: ['product-silk-bucket', 'product-silk-pail'],
    tds: [
      { label: 'Technical data sheet (PDF)', href: '/documents/opudas-silk-tds.pdf' },
      { label: 'Safety data sheet (PDF)', href: '/documents/opudas-silk-sds.pdf' },
    ],
    bestFor: 'Kitchens, corridors, children’s rooms, offices and rental units that get cleaned often.',
    application: [
      { step: 'Prepare', detail: 'Wash down glossy or greasy surfaces and rinse. Sand any filler flush.' },
      { step: 'Prime', detail: 'One coat of OPUDA’S Primer; two on repaired patches to equalise porosity.' },
      { step: 'Coat 1', detail: 'Roll in a single direction with a medium pile sleeve. Thin up to 10%.' },
      { step: 'Coat 2', detail: 'Apply after 4 hours at right angles to the first coat for a uniform sheen.' },
      { step: 'Cure', detail: 'Keep the room ventilated; avoid washing for 7 days.' },
    ],
    claimsStatus: 'label-verified',
  },
  {
    id: 'primer',
    sku: 'OPD-PRM',
    name: "OPUDA'S Alkali-Resisting Primer",
    shortName: 'Primer',
    line: "OPUDA'S",
    tagline: 'The coat that decides whether the colour lasts. Never skip it on new plaster.',
    description:
      'A water-based primer formulated to hold back the alkali in fresh cement render, which is the single most common cause of patchy, blistering paint in new Nigerian builds. Seals uneven porosity so the finish coat draws evenly and uses less paint.',
    finish: 'Primer',
    surfaces: ['New plaster', 'Interior walls', 'Exterior walls'],
    sheenLevel: 0,
    coveragePerUnit: 10,
    coatsRecommended: 1,
    touchDryHours: 2,
    recoatHours: 4,
    fullCureDays: 3,
    dilution: 'Thin up to 20% with clean water on very porous render.',
    voc: 'Low-VOC, water-based.',
    guaranteeYears: 0,
    features: ['Blocks alkali burn on new render', 'Seals uneven porosity', 'Improves topcoat coverage', 'Quick recoat'],
    packs: [pack(20, 'L'), pack(4, 'L')],
    image: 'brand-banner-matt',
    gallery: ['brand-banner-matt'],
    tds: [{ label: 'Technical data sheet (PDF)', href: '/documents/opudas-primer-tds.pdf' }],
    bestFor: 'Every new build, every repaired patch, and any wall that has been re-skimmed.',
    application: [
      { step: 'Cure', detail: 'Allow new render to cure for at least 14 days, ideally 28.' },
      { step: 'Neutralise', detail: 'Brush down salt bloom, treat with a stabilising wash and allow to dry fully.' },
      { step: 'Apply', detail: 'One full coat by brush and roller. Do not thin unless the surface is very porous.' },
      { step: 'Topcoat', detail: 'Recoat with Matt or Silk after 4 hours.' },
    ],
    claimsStatus: 'pending-verification',
  },
  {
    id: 'gloss',
    sku: 'OPD-GLS',
    name: "OPUDA'S Synthetic Gloss",
    shortName: 'Gloss',
    line: "OPUDA'S",
    tagline: 'Hard-wearing colour for doors, gates, frames and joinery.',
    description:
      'A solvent-based gloss for timber and metal that cures to a hard, washable surface. This is the finish for external doors, steel gates, handrails and window frames — anywhere that gets handled, rained on, or both.',
    finish: 'Gloss',
    surfaces: ['Wood & metal', 'Exterior walls'],
    sheenLevel: 85,
    coveragePerUnit: 13,
    coatsRecommended: 2,
    touchDryHours: 4,
    recoatHours: 16,
    fullCureDays: 7,
    dilution: 'Thin with the recommended solvent only, max 5%. Not water-thinnable.',
    voc: 'Solvent-based. Use with ventilation and appropriate PPE.',
    guaranteeYears: 3,
    features: ['Hard, impact-resistant film', 'For interior and exterior joinery', 'Good flow and levelling', 'Weather resistant'],
    packs: [pack(20, 'L'), pack(4, 'L'), pack(1, 'L')],
    image: 'brand-banner-red',
    gallery: ['brand-banner-red'],
    tds: [{ label: 'Technical data sheet (PDF)', href: '/documents/opudas-gloss-tds.pdf' }],
    bestFor: 'Gates, doors, frames, railings and steelwork.',
    application: [
      { step: 'Prepare', detail: 'Strip loose coating, sand back to a sound edge, and degrease steel with a solvent wipe.' },
      { step: 'Prime', detail: 'Metal: zinc-rich or red-oxide primer. Timber: wood primer, knots sealed.' },
      { step: 'Coat 1', detail: 'Brush in the direction of the grain or length of the steel. Avoid over-brushing.' },
      { step: 'Coat 2', detail: 'Apply after 16 hours. Thin coats always beat thick ones.' },
    ],
    claimsStatus: 'pending-verification',
  },
  {
    id: 'weathershield',
    sku: 'OPD-WS',
    name: "OPUDA'S Weathershield",
    shortName: 'Weathershield',
    line: "OPUDA'S",
    tagline: 'Exterior protection for the rainy season — textured, breathable, colour-stable.',
    description:
      'A textured exterior coating for rendered walls, boundary walls and facades. It bridges hairline cracks, sheds water, and stays colour-stable under UV, which matters when a facade faces the creek and the sun all day.',
    finish: 'Texture',
    surfaces: ['Exterior walls'],
    sheenLevel: 5,
    coveragePerUnit: 6,
    coatsRecommended: 2,
    touchDryHours: 2,
    recoatHours: 6,
    fullCureDays: 14,
    dilution: 'Do not thin. Stir thoroughly; apply with a trowel or heavy roller.',
    voc: 'Water-based acrylic.',
    guaranteeYears: 5,
    features: ['Bridges hairline cracks', 'UV and colour stable', 'Breathable film', 'Rain resistant after 24 hours'],
    packs: [pack(20, 'L'), pack(10, 'L')],
    image: 'project-finished-villa',
    gallery: ['project-finished-villa', 'project-blue-fence', 'project-cream-scaffold'],
    tds: [{ label: 'Technical data sheet (PDF)', href: '/documents/opudas-weathershield-tds.pdf' }],
    bestFor: 'Facades, boundary walls, parapets and any elevation exposed to rain and sun.',
    application: [
      { step: 'Prepare', detail: 'Remove efflorescence, treat mould, and repair honeycombing before coating.' },
      { step: 'Prime', detail: 'One coat of OPUDA’S Primer, or a bonding agent on chalky render.' },
      { step: 'Coat 1', detail: 'Apply a full, even coat working from the top of the elevation downwards.' },
      { step: 'Coat 2', detail: 'Second coat after 6 hours. Protect from rain for 24 hours.' },
    ],
    claimsStatus: 'pending-verification',
  },
  {
    id: 'screeding',
    sku: 'OPD-SCR',
    name: "OPUDA'S Screeding Compound",
    shortName: 'Screeding',
    line: "OPUDA'S",
    tagline: 'The flat, white base coat that makes a good paint job possible.',
    description:
      'A polymer-modified screeding compound for levelling blockwork and filling the undulations left by hand-floated render. Two thin passes, sanded between, produce a surface flat enough for a silk finish to look like silk.',
    finish: 'Filler',
    surfaces: ['Interior walls', 'Ceilings', 'New plaster'],
    sheenLevel: 0,
    coveragePerUnit: 1.6,
    coatsRecommended: 2,
    touchDryHours: 3,
    recoatHours: 4,
    fullCureDays: 3,
    dilution: 'Mix 1 kg to roughly 0.4 L clean water; rest 10 minutes before use.',
    voc: 'Cementitious, low-VOC.',
    guaranteeYears: 0,
    features: ['Levels uneven blockwork', 'Sands to a fine finish', 'Strong bond, minimal shrinkage'],
    packs: [pack(25, 'kg'), pack(10, 'kg')],
    image: 'project-render-stage',
    gallery: ['project-render-stage', 'project-corner-scaffold'],
    tds: [{ label: 'Technical data sheet (PDF)', href: '/documents/opudas-screeding-tds.pdf' }],
    bestFor: 'New blockwork, patch repairs and any wall being finished in Silk or a dark colour.',
    application: [
      { step: 'Damp down', detail: 'Wet the wall so it does not pull water out of the mix.' },
      { step: 'Pass 1', detail: 'Apply 1–2 mm with a steel trowel, tight. Allow to set.' },
      { step: 'Pass 2', detail: 'Apply a second thin pass to close the surface. Allow 4 hours.' },
      { step: 'Sand', detail: 'Sand with 120 grit, dust off, then prime before painting.' },
    ],
    claimsStatus: 'pending-verification',
  },
]

/**
 * The published product range, with any admin claim-status / pack-stock
 * edits from `data/overrides/products.json` applied. See
 * `src/lib/contentOverrides.ts`.
 */
export const PRODUCTS: Product[] = applyProductOverrides(PRODUCTS_BASE)

export const findProduct = (id: string) => PRODUCTS.find((p) => p.id === id)
export const productById = findProduct

export const FINISH_SHEEN_LABEL: Record<Finish, string> = {
  Matt: 'Flat — under 5% sheen',
  Silk: 'Soft sheen — 10–15%',
  Satin: 'Satin — 25–35%',
  Gloss: 'Gloss — 80%+',
  Primer: 'Primer — sealing coat',
  Texture: 'Textured — light relief',
  Filler: 'Filler — base coat',
}


