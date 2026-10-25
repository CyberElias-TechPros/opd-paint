/**
 * Site record.
 *
 * Every image in this file is a real photograph supplied by OPUDA'S PAINT.
 * Client names are withheld; locations are given at city/estate level only.
 * Each entry is tagged with the palette and product system used so the
 * "shop this project" path is traceable back to real colour records.
 */

export type Stage = 'completed' | 'in progress' | 'concept'

export type Project = {
  id: string
  title: string
  location: string
  year: string
  stage: Stage
  kind: 'Residential' | 'Exterior' | 'Interior' | 'Boundary & gate' | 'Concept design'
  summary: string
  story: string[]
  cover: string
  gallery: string[]
  colorIds: string[]
  productIds: string[]
  paletteId: string
  /** One line a visitor can act on. */
  takeaway: string
}

export const PROJECTS: Project[] = [
  {
    id: 'arched-villa-lekki',
    title: 'The arched villa',
    location: 'Lekki, Lagos',
    year: '2025',
    stage: 'completed',
    kind: 'Exterior',
    summary:
      'A two-storey build with stone-clad piers and a deep arched entrance, finished in warm off-white with grey pilasters and a charcoal roof.',
    story: [
      'The brief was restraint: let the stone and the arch do the work, and keep the painted surfaces quiet enough to sit behind them.',
      'The body of the house was finished in a warm off-white with the pier faces picked out in a cooler grey, so the elevation reads as two planes rather than one flat wall. The plinth and boundary pillars carry a brick-red band that ties the house to the street wall.',
      'Because the facade faces the weather, the exterior system was built on primer plus two full coats, with the top coat applied from the top of the elevation downwards so that any lap marks fall behind the scaffold line rather than across the arch.',
    ],
    cover: 'project-finished-villa',
    gallery: ['project-finished-villa', 'project-arched-facade', 'project-dark-roof', 'project-blue-fence'],
    colorIds: ['bone', 'pebble', 'brick-lane', 'graphite', 'opuda-white'],
    productIds: ['weathershield', 'primer', 'matt'],
    paletteId: 'terracotta-court',
    takeaway: 'Off-white plus a grey pier and a brick plinth — three colours, no more.',
  },
  {
    id: 'lagoon-facade',
    title: 'Lagoon-facing facade',
    location: 'Ikoyi, Lagos',
    year: '2025',
    stage: 'completed',
    kind: 'Exterior',
    summary:
      'A cream render with strong white bands and a stone feature column, painted while the surrounding estate was still under construction.',
    story: [
      'Salt air and direct afternoon sun are unforgiving on exterior colour. This elevation was specified in the Weathershield system with a primer base so that the render’s varying porosity would not print through as patches.',
      'The white bands and cornice were cut in first and allowed to cure, so the cream body colour could be brushed up to a hard, straight line without masking tape lifting the fresh film.',
    ],
    cover: 'project-cream-scaffold',
    gallery: ['project-cream-scaffold', 'project-painter', 'project-corner-scaffold'],
    colorIds: ['ivory-coast', 'opuda-white', 'stone-white', 'slate-grey'],
    productIds: ['weathershield', 'primer'],
    paletteId: 'harmattan-haze',
    takeaway: 'Cut in the light bands first, then bring the body colour to them.',
  },
  {
    id: 'lilac-lounge-lekki',
    title: 'The lilac lounge',
    location: 'Lekki Phase 1, Lagos',
    year: '2024',
    stage: 'completed',
    kind: 'Interior',
    summary:
      'A living room wrapped in lilac with a deeper plum alcove, white cornice and a peach corridor beyond.',
    story: [
      'This is the room that gave us Lilac Room. The client wanted colour that would not date, and a half-height lilac above a deeper plum in the recessed alcove achieved depth without darkening the space.',
      'Everything was finished in Silk rather than Matt: the room opens onto a balcony, and the washable sheen has held up to two rainy seasons of humidity without blooming.',
      'The cornice and picture rail were kept in Opuda White so the eye reads the architecture first and the colour second.',
    ],
    cover: 'interior-lilac-lounge',
    gallery: ['interior-lilac-lounge'],
    colorIds: ['lilac-room', 'dusty-grape', 'opuda-white', 'blush-room'],
    productIds: ['silk', 'primer'],
    paletteId: 'lilac-lounge',
    takeaway: 'Use a deeper tone inside the recess, not on the wall beside it.',
  },
  {
    id: 'peach-corridor',
    title: 'Peach corridor',
    location: 'Ajah, Lagos',
    year: '2024',
    stage: 'in progress',
    kind: 'Interior',
    summary:
      'A circulation space with no daylight, treated with warm peach and a coral recess so the corridor feels lit even in the evening.',
    story: [
      'Corridors are where warm colours earn their keep. The peach here is applied in Matt — at this distance from the eye, texture is invisible and the extra coverage matters.',
      'The photograph was taken before the floor was cleaned and the joinery fitted: this is what a room looks like the day after the second coat, which is the honest moment to photograph a paint job.',
    ],
    cover: 'interior-mauve-peach',
    gallery: ['interior-mauve-peach'],
    colorIds: ['apricot-wall', 'coral-dust', 'coconut-milk', 'mauve-linen'],
    productIds: ['matt', 'primer'],
    paletteId: 'peach-corridor',
    takeaway: 'In a dark corridor, go warmer than you think you should.',
  },
  {
    id: 'blue-boundary',
    title: 'Blue boundary wall',
    location: 'Ajah, Lagos',
    year: '2025',
    stage: 'completed',
    kind: 'Boundary & gate',
    summary:
      'A turquoise boundary wall with black steel spikes, stone-white render and rusticated brick piers.',
    story: [
      'A boundary wall is the largest painted surface most Lagos homes own, and the one most often left grey. This one was specified in a saturated outdoor blue that holds its colour under UV.',
      'The ironwork was finished in Window Black rather than a pure black: under direct sun, pure black reads as a hole, while a soft black keeps the detail of the spikes and scrollwork visible.',
    ],
    cover: 'project-blue-fence',
    gallery: ['project-blue-fence', 'project-gate', 'project-stone-brick'],
    colorIds: ['blue-fence', 'window-black', 'stone-white', 'brick-lane'],
    productIds: ['weathershield', 'gloss', 'primer'],
    paletteId: 'blue-fence',
    takeaway: 'Soft black on ironwork keeps the detail; pure black loses it.',
  },
  {
    id: 'modern-cube',
    title: 'Modern cube study',
    location: 'Concept — Ikoyi',
    year: '2026',
    stage: 'concept',
    kind: 'Concept design',
    summary:
      'An architectural study testing how much of a contemporary facade can be carried by colour blocking alone: white, charcoal and timber.',
    story: [
      'These renders exist to answer a question we get weekly: how do you make a plain rendered house look designed?',
      'The answer in this study is proportion, not paint: a charcoal volume floats above a white base, with timber battens providing the only warmth. The palette is two colours and a material.',
      'Marked as a concept because no paint has been applied yet — the value here is the decision, which is exactly the point at which we like to be involved.',
    ],
    cover: 'render-modern-grey',
    gallery: ['render-modern-grey', 'render-modern-white'],
    colorIds: ['charcoal-wall', 'stone-white', 'graphite'],
    productIds: ['weathershield', 'primer'],
    paletteId: 'plum-study',
    takeaway: 'Two colours and a material will beat five colours and no logic.',
  },
]

export const findProject = (id: string) => PROJECTS.find((p) => p.id === id)

export const STAGE_LABEL: Record<Stage, string> = {
  completed: 'Completed',
  'in progress': 'In progress',
  concept: 'Concept',
}
