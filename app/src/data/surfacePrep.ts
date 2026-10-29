/**
 * Surface-preparation decision support.
 *
 * This is not new technical claims — it is the trade sequence already written
 * out in long form in `guides.ts` (`preparing-walls`, `damp-and-mould`),
 * restructured as "tell us your situation, get the sequence" instead of an
 * article you have to read end to end on site with wet hands. Every step here
 * traces back to one of those two guides; where it doesn't, it is standard,
 * uncontroversial decorating practice (wash before you paint, key a gloss
 * surface before recoating it) rather than an Opuda-specific claim.
 */
import type { Guide } from './guides'
import type { Product } from './products'

export type PrepCondition = {
  id: string
  label: string
  description: string
  steps: string[]
  warning?: string
  relatedProducts: Product['id'][]
  relatedGuide: Guide['id']
}

export const PREP_CONDITIONS: PrepCondition[] = [
  {
    id: 'new-render',
    label: 'New render or bare plaster',
    description: 'Freshly rendered block work, skimmed plaster, or a new-build wall that has never been painted.',
    steps: [
      'Let it cure — 14 days minimum, 28 preferred. Cement render cures by chemical reaction, not by drying, and painting too early traps moisture behind the film.',
      'Check with the polythene test: tape a clear square to the wall for 24 hours. Condensation on the underside means it is still releasing moisture — wait.',
      'Fill hollows with a screeding compound, not a thick coat of paint. Two thin passes, sanded at 120 grit between.',
      'Wipe down to remove dust. A wall that still feels chalky to the hand will not hold paint.',
      'Apply one full coat of primer — it equalises porosity and blocks alkali so the topcoat draws evenly.',
      'Apply the topcoat once primed: two coats, the second after the recoat time on the pack.',
    ],
    relatedProducts: ['screeding', 'primer', 'matt'],
    relatedGuide: 'preparing-walls',
  },
  {
    id: 'old-gloss',
    label: 'Previously painted, glossy or oil-based',
    description: 'An existing film that is sound but shiny — gloss trim, an old oil-based topcoat, or a high-sheen emulsion.',
    steps: [
      'Wash with a sugar-soap or detergent solution to remove grease, nicotine and dust. A new coat will not grip over a greasy film.',
      'Key the surface — a light sand to cut the sheen — so the new coat has something to bite into.',
      'Spot-prime any bare patches the sanding exposes.',
      'Apply the topcoat as normal: two coats on walls, the manufacturer\u2019s recoat time between.',
    ],
    relatedProducts: ['primer'],
    relatedGuide: 'preparing-walls',
  },
  {
    id: 'damp-patch',
    label: 'Damp patch or active moisture',
    description: 'A tide mark, a soft or bubbling patch, or a wall that is visibly wet.',
    warning:
      'Never seal a wet wall. A coat of paint over active damp traps moisture behind the film — it will blister from behind, and no topcoat can repair that.',
    steps: [
      'Find the source before anything else: a failed roof or gutter, a bridged damp-proof course, a plumbing leak, or rising moisture are the four usual causes. Trace the tide mark upward — water travels down, not sideways.',
      'Fix the source. Painting over a live leak hides the symptom for a season at most.',
      'Let the wall dry fully, and confirm with the polythene test.',
      'Remove any blown or powdery coating back to sound substrate.',
      'Fill, prime, and apply two full coats — ideally one with an anti-fungi additive in a room with a history of damp.',
    ],
    relatedProducts: ['screeding', 'primer', 'matt'],
    relatedGuide: 'damp-and-mould',
  },
  {
    id: 'efflorescence',
    label: 'White, powdery salt bloom',
    description: 'Efflorescence — soluble salts carried to the surface by water, usually on a newer or previously damp wall.',
    warning: 'Painting over efflorescence guarantees the new film will lift in sheets, taking the salt with it.',
    steps: [
      'Dry-brush the bloom away. Do not wash it in — that redissolves the salts and spreads them.',
      'Find and fix the source of the moisture carrying the salts to the surface.',
      'Treat the wall with a stabilising wash and allow it to dry completely.',
      'Prime, then apply the topcoat once the wall is confirmed dry.',
    ],
    relatedProducts: ['primer'],
    relatedGuide: 'preparing-walls',
  },
  {
    id: 'exterior-exposed',
    label: 'Exterior wall — sun, rain or salt air',
    description: 'An exterior elevation exposed to direct weather, humidity or the salt-laden air common near the coast.',
    steps: [
      'Confirm the render has fully cured (see "New render" if it has not) and is structurally sound — hairline cracks let water in behind the film.',
      'Repair cracks and hollows with a screeding compound before priming.',
      'Prime bare or repaired areas with an alkali-resisting primer.',
      'Apply a weather-resistant exterior coating in full coats, allowing the full recoat time between each — humidity extends drying in the rainy season.',
      'In a coastal, salt-air environment, inspect more often than an interior wall and repaint promptly at the first sign of chalking.',
    ],
    relatedProducts: ['screeding', 'primer', 'weathershield'],
    relatedGuide: 'preparing-walls',
  },
  {
    id: 'sound-repaint',
    label: 'Already painted, clean and sound',
    description: 'A wall in good condition that just needs a colour refresh — no damp, no damage, no peeling.',
    steps: [
      'Wash down to remove dust, cobwebs and surface grease.',
      'Fill any small dents or nail holes and sand smooth.',
      'Lightly sand any glossy sheens so the new coat keys to the surface.',
      'Apply one or two coats depending on how much the colour is changing — a strong colour change usually needs the full two.',
    ],
    relatedProducts: ['matt', 'silk'],
    relatedGuide: 'matt-or-silk',
  },
]
