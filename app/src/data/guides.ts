/**
 * Practical guides.
 *
 * Content rules (see README “Customer trust and accuracy”):
 *  • No safety, VOC or performance claim appears here that is not on the
 *    product label or in the technical data sheet.
 *  • Every article carries an author, a review date and a source note.
 *  • Time-sensitive content (prices, availability, regulation) is not published
 *    in guides — it belongs in the live data layer.
 */

import { applyGuideOverrides } from '../lib/contentOverrides'

export type GuideSection = {
  heading: string
  paragraphs: string[]
  list?: string[]
  callout?: { title: string; body: string; tone: 'note' | 'warning' | 'tip' }
}

export type Guide = {
  id: string
  title: string
  category: 'Planning' | 'Preparation' | 'Application' | 'Colour' | 'Troubleshooting'
  summary: string
  readMinutes: number
  updated: string
  reviewer: string
  hero: string
  sections: GuideSection[]
  relatedColors: string[]
  relatedProducts: string[]
  faq: { q: string; a: string }[]
}

const GUIDES_BASE: Guide[] = [
  {
    id: 'how-much-paint',
    title: 'How much paint do I actually need?',
    category: 'Planning',
    summary:
      'The arithmetic behind a paint estimate, why two coats is not a sales tactic, and the four places people underestimate.',
    readMinutes: 7,
    updated: '2026-08-12',
    reviewer: 'OPUDA’S technical desk',
    hero: 'project-render-stage',
    sections: [
      {
        heading: 'Start with the wall, not the tin',
        paragraphs: [
          'A paint tin tells you what one litre covers on a sound, sealed surface. It cannot tell you how much wall you have. Measure the room first: perimeter times height gives wall area, and length times width gives the ceiling.',
          'For a room 4.2 m by 3.6 m with a 2.9 m ceiling, the perimeter is 2 × (4.2 + 3.6) = 15.6 m. Multiply by 2.9 m and you have 45.24 m² of wall. The ceiling adds 4.2 × 3.6 = 15.12 m².',
        ],
        callout: {
          title: 'The four things people forget',
          body: 'Openings are deducted only when they are large; skirting and reveals get cut in from the same bucket; the second coat uses about the same as the first; and a 5% handling allowance covers roller loss and touch-ups.',
          tone: 'note',
        },
      },
      {
        heading: 'Two coats, properly',
        paragraphs: [
          'Two coats is not a manufacturer’s trick to sell more paint. The first coat is absorbed unevenly by the substrate and is where opacity is built. The second coat provides the continuous, washable film. One heavy coat looks fine wet and fails within a year — it cures with thin patches over the filler and thick ridges over the plaster.',
          'On a dramatic colour change — white to a deep green, or a dark wall to white — budget for a third coat, or specify a tinted primer to get the base closer to the finish before you start.',
        ],
      },
      {
        heading: 'The allowance that saves the job',
        paragraphs: [
          'Add 5 to 10 per cent for handling. It sounds wasteful until you are 0.6 m² short on the last wall at 5pm, and the only tin left in the shop is a different batch.',
          'Keep the surplus tin, labelled with the colour code and the room, for touch-ups. It will match exactly; a fresh tin mixed six months later may not.',
        ],
        list: [
          'Measure in metres, not feet, unless you are buying imperial pack sizes.',
          'Deduct doors and windows over roughly 1 m² each.',
          'Add 5–10% handling for roller loss and touch-ups.',
          'Round up to the nearest pack size — never buy under.',
        ],
      },
    ],
    relatedColors: ['bone', 'savannah-sand'],
    relatedProducts: ['matt', 'silk'],
    faq: [
      { q: 'Does one litre really cover 11 m²?', a: 'On a sealed, smooth interior wall, yes — for one coat. On porous new plaster, expect closer to 7–8 m² for the first coat.' },
      { q: 'Do I need to deduct windows?', a: 'Deduct openings larger than about 1 m². Small vents and recesses are not worth the arithmetic, and the allowance covers them.' },
    ],
  },
  {
    id: 'preparing-walls',
    title: 'Preparing walls in Nigerian weather',
    category: 'Preparation',
    summary:
      'Heat, humidity and cement render are a demanding combination. This is the preparation sequence that keeps a finish coat from failing.',
    readMinutes: 9,
    updated: '2026-08-20',
    reviewer: 'OPUDA’S technical desk',
    hero: 'project-cream-scaffold',
    sections: [
      {
        heading: 'Let new render cure — properly',
        paragraphs: [
          'Cement render cures by chemical reaction, not by drying. Painting at 7 days traps moisture and alkali behind the film, which is why brand-new walls blister within weeks. Allow 14 days as an absolute minimum, and 28 days wherever the schedule permits.',
          'A simple test: tape a square of clear polythene tight to the wall for 24 hours. If condensation forms on the underside, the wall is still releasing moisture — wait.',
        ],
      },
      {
        heading: 'Treat salt bloom before you paint it back',
        paragraphs: [
          'White, powdery patches on a wall are efflorescence: soluble salts carried to the surface by water. Painting over it guarantees the paint will lift in sheets, taking the salt with it.',
          'Dry-brush the bloom away, find and fix the source of the moisture, then treat the wall with a stabilising wash and allow it to dry completely before priming.',
        ],
        callout: {
          title: 'Never seal a wet wall',
          body: 'A coat of gloss or a waterproof sealer over an actively damp wall traps moisture inside. The film will blister from behind, and no topcoat can repair that.',
          tone: 'warning',
        },
      },
      {
        heading: 'Fill, sand, dust, prime',
        paragraphs: [
          'Fill hollows with a screeding compound rather than a thick coat of paint. Two thin passes, sanded with 120 grit between, produce a surface flat enough for a silk finish to look like silk.',
          'Dust is the enemy of adhesion. Wipe down with a damp cloth and allow the surface to dry; a wall that feels chalky to the hand will not hold paint.',
          'Prime everything. Primer is not optional on a new build: it equalises porosity so the topcoat draws evenly, blocks alkali, and pays for itself in reduced topcoat consumption.',
        ],
        list: [
          '14 days minimum cure on new render; 28 preferred.',
          'Fix the water source before treating efflorescence.',
          'Fill with screeding compound, not paint.',
          'Sand at 120 grit, then dust off.',
          'One full primer coat on anything new or repaired.',
        ],
      },
      {
        heading: 'Work with the season',
        paragraphs: [
          'In the rainy season, humidity slows drying and extends recoat times — sometimes by double. In the harmattan, dust settles on wet paint and dry heat can flash-dry a wall before you have laid it off.',
          'Practical rule: paint early in the day, keep the room ventilated, and never apply a water-based coat when the wall temperature is high enough to be uncomfortable to touch. If you can feel heat radiating from the render, wait.',
        ],
      },
    ],
    relatedColors: ['limestone', 'coconut-milk'],
    relatedProducts: ['primer', 'screeding', 'matt'],
    faq: [
      { q: 'Can I paint over a wall that has been painted before?', a: 'Yes, if the existing film is sound and clean. Wash it, sand glossy areas, and spot-prime any bare patches. If it is flaking, strip it back first.' },
      { q: 'How do I know the wall is dry enough?', a: 'The polythene test above, plus time. There is no shortcut that a primer can compensate for.' },
    ],
  },
  {
    id: 'matt-or-silk',
    title: 'Matt or Silk? Choosing the right finish',
    category: 'Application',
    summary:
      'The difference is not just shine. It changes how long the wall lasts, how it cleans, and what the colour looks like at night.',
    readMinutes: 5,
    updated: '2026-07-30',
    reviewer: 'OPUDA’S technical desk',
    hero: 'product-silk-bucket',
    sections: [
      {
        heading: 'What the finish actually does',
        paragraphs: [
          'Matt scatters light in every direction, which hides surface imperfections and gives a deep, flat colour. Its weakness is that the film is more open: it stains more easily and does not take scrubbing well.',
          'Silk has a tighter, slightly reflective film. It is washable, resists condensation and cooking steam, and lifts light into a dark room. In exchange, it shows every ripple in the plaster, so the preparation has to be better.',
        ],
      },
      {
        heading: 'A room-by-room answer',
        paragraphs: [
          'Bedrooms and lounges usually want Matt: the colour is truer, the surface is quieter, and you are not scrubbing those walls. Kitchens, corridors, bathrooms, children’s rooms and rental units are better served by Silk.',
          'Ceilings are almost always Matt, in the brightest white in the range, unless the ceiling is under a bathroom or kitchen where condensation collects.',
        ],
        list: [
          'Matt — bedrooms, lounges, ceilings, feature walls, budget work.',
          'Silk — kitchens, corridors, bathrooms, children’s rooms, offices.',
          'Do not mix finishes on one wall; the join will read as a patch.',
        ],
      },
      {
        heading: 'How finish changes colour',
        paragraphs: [
          'A deep colour looks darker in matt and richer in silk, because silk returns more light toward the eye. Never approve a deep colour from a small matt chip if the wall will be painted in silk: ask for a sample of the actual product.',
          'And always look at the sample in the room, at the time of day you will use the room. Colour is a property of light as much as of paint.',
        ],
        callout: {
          title: 'Screens lie a little',
          body: 'Every colour on this website is a digital approximation. A screen emits light; paint reflects it. Order a sample pot or visit a dealer before committing to a full room.',
          tone: 'note',
        },
      },
    ],
    relatedColors: ['lilac-room', 'sage-whisper'],
    relatedProducts: ['matt', 'silk'],
    faq: [
      { q: 'Can I use Silk on a ceiling?', a: 'You can, but the sheen can show roller marks in raking light. We recommend Matt on ceilings except in bathrooms and kitchens.' },
      { q: 'Is Silk harder to apply?', a: 'It is less forgiving of poor preparation. Two full coats and good sanding matter more than the technique.' },
    ],
  },
  {
    id: 'colour-on-screen',
    title: 'Why your wall will look different from your screen',
    category: 'Colour',
    summary:
      'A straight explanation of display calibration, lighting temperature and why a digital swatch is a guide rather than a guarantee.',
    readMinutes: 6,
    updated: '2026-09-02',
    reviewer: 'OPUDA’S colour desk',
    hero: 'interior-lilac-lounge',
    sections: [
      {
        heading: 'Two different physical processes',
        paragraphs: [
          'A screen makes light; paint reflects it. A screen can emit a saturated blue at an intensity no paint can reflect, because the paint is limited by the light falling on it. This is why deep colours in particular look more muted on a wall than on a phone.',
          'On top of that, every screen is calibrated differently. Two phones side by side, both showing the same hex value, can differ visibly — and a phone in sunlight is a different device from the same phone at night.',
        ],
      },
      {
        heading: 'Light changes everything',
        paragraphs: [
          'The same lilac reads cool in the flat, grey light of a rainy Port Harcourt morning and warm under a 3000K bulb at 8pm. A west-facing wall at golden hour is a different colour from a north-facing wall at noon.',
          'Sample, then live with it. Paint a 1 m² patch on two walls of the room, one that gets morning light and one that gets evening light, and look at both for a few days.',
        ],
      },
      {
        heading: 'What we do about it',
        paragraphs: [
          'Our colour library stores one sRGB value per colour and shows the Light Reflectance Value as an estimate derived from that digital value, clearly labelled. We do not present a screen preview as a match guarantee.',
          'The room preview tool on this site is a simulation: it changes hue while preserving the photograph’s shadows and texture, which is useful for comparing options, not for approving a final colour.',
        ],
        callout: {
          title: 'The only reliable check',
          body: 'A painted sample on the actual wall, in the actual light, at the actual finish. Order a sample pot or ask a dealer for a chip before you commit.',
          tone: 'tip',
        },
      },
    ],
    relatedColors: ['lilac-room', 'mauve-linen', 'blue-fence'],
    relatedProducts: ['matt', 'silk'],
    faq: [
      { q: 'Is the hex code the same as the paint formula?', a: 'No. A hex code is a screen value. The tinting formula is a separate set of pigment weights held by the manufacturer and the dealer.' },
      { q: 'Why does my colour look different after it dries?', a: 'Water-based paint dries lighter, and the film flattens as it cures. Judge the colour after 24 hours, not wet.' },
    ],
  },
  {
    id: 'cutting-in',
    title: 'Cutting in: the skill that decides the job',
    category: 'Application',
    summary:
      'Straight lines between wall and ceiling, and a roller that never has to fight an edge.',
    readMinutes: 6,
    updated: '2026-06-18',
    reviewer: 'OPUDA’S technical desk',
    hero: 'project-painter',
    sections: [
      {
        heading: 'Cut in first, always',
        paragraphs: [
          'Cut in the ceiling line and the corners with a brush before the roller touches the wall. A loaded roller pushed into a corner pushes paint onto the adjacent surface; a brush can stop exactly where you want it to.',
          'Work in sections you can finish while the edge is still wet. A wet edge blends; a dry edge leaves a visible lap mark that no amount of extra paint will hide.',
        ],
      },
      {
        heading: 'The technique',
        paragraphs: [
          'Load the brush to about a third of its bristle length — enough to flow, not enough to drip. Hold it like a pencil, brace your hand against the wall, and draw a single steady line away from your body.',
          'Roll within 10–15 minutes of cutting in, using the same product at the same dilution. The roller should overlap the brushed band by about half its width so the texture matches.',
        ],
        list: [
          'Cut in ceilings and corners before rolling.',
          'Load the brush one third; brace your hand on the wall.',
          'Roll into the wet edge within 15 minutes.',
          'Masking tape is a fallback, not a technique — remove it while the paint is still soft.',
        ],
      },
      {
        heading: 'Two-colour walls',
        paragraphs: [
          'Where two colours meet on the same plane, paint the lighter colour first, allow it to cure fully, then tape and paint the darker. Dark over light hides tape creep; light over dark does not.',
          'Pull the tape at a shallow angle while the paint is still slightly soft. If you wait until it is fully hard, the film bridges the tape edge and tears away from the wall.',
        ],
      },
    ],
    relatedColors: ['opuda-white', 'graphite'],
    relatedProducts: ['matt', 'silk', 'gloss'],
    faq: [
      { q: 'Frog tape or regular masking tape?', a: 'For a crisp line on a cured, painted surface, a quality low-tack tape is worth it. On fresh plaster, tape can pull the surface — cut in freehand instead.' },
      { q: 'Why are my corners patchy?', a: 'Usually under-loaded brush and a dry edge. Two thin bands beat one thick one.' },
    ],
  },
  {
    id: 'damp-and-mould',
    title: 'Damp walls, mould and what paint can and cannot fix',
    category: 'Troubleshooting',
    summary:
      'Paint is a coating, not a damp course. How to diagnose the cause before you spend money on a decorative finish.',
    readMinutes: 8,
    updated: '2026-09-14',
    reviewer: 'OPUDA’S technical desk',
    hero: 'project-stone-brick',
    sections: [
      {
        heading: 'Diagnose first',
        paragraphs: [
          'Most damp on Nigerian walls comes from one of four places: a failed roof or gutter, a bridged damp-proof course, plumbing leakage, or rising moisture in a wall built directly off the ground. Painting over any of these hides the symptom for a season at most.',
          'Find the source. Trace the tide mark upward, check the roof line above it, and look for the highest point of dampness — water travels down, not sideways.',
        ],
        callout: {
          title: 'A rule worth repeating',
          body: 'No coating, at any price, will stop rising damp. If the cause is structural, fix the structure. Paint comes after.',
          tone: 'warning',
        },
      },
      {
        heading: 'Mould is a symptom',
        paragraphs: [
          'Black mould needs moisture and a food source (typically dust and organic film). Washing it off without reducing the humidity means it returns in weeks. Increase ventilation, fix leaks, and only then treat the surface.',
          'Treat with a proprietary fungicidal wash, allow to dry thoroughly, and use a product with an anti-fungi additive such as OPUDA’S Matt or Silk for the finish coats.',
        ],
      },
      {
        heading: 'When the wall is sound again',
        paragraphs: [
          'Once the moisture source is fixed and the wall has dried (the polythene test is your friend), remove any blown or powdery coating back to sound substrate, prime, fill, and apply two coats.',
          'Expect the first winter to be the test. Photograph the wall now so you have a reference for what normal looks like.',
        ],
      },
    ],
    relatedColors: ['opuda-white', 'stone-white'],
    relatedProducts: ['primer', 'matt'],
    faq: [
      { q: 'Does anti-fungi paint stop mould?', a: 'The additive protects the paint film itself. It does not remove moisture from the room, so ventilation and leak repair still matter.' },
      { q: 'Can I paint over a damp patch?', a: 'No. Let it dry and fix the source first, or the new film will blister from behind.' },
    ],
  },
]

/**
 * The published guides, with any admin reviewer/updated edits from
 * `data/overrides/guides.json` applied. See `src/lib/contentOverrides.ts`.
 */
export const GUIDES: Guide[] = applyGuideOverrides(GUIDES_BASE)

export const CATEGORIES = ['Planning', 'Preparation', 'Application', 'Colour', 'Troubleshooting'] as const
export const findGuide = (id: string) => GUIDES.find((g) => g.id === id)
