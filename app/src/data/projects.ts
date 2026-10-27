/**
 * Site record.
 *
 * Every image in this file is a real photograph supplied by OPUDA'S PAINT.
 * Client names are withheld; locations are given at city/estate level only.
 * Most entries are tagged with the palette and product system used so the
 * "shop this project" path is traceable back to real colour records. Where a
 * photograph arrived with no job sheet or colour spec attached, colorIds and
 * productIds are left as an empty array and paletteId as an empty string
 * rather than guessed at from the image — the copy for those projects stays
 * to what is visibly true of the photograph, not what paint was used.
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
    id: 'arched-villa-gra',
    title: 'The arched villa',
    location: 'GRA Phase 2, Port Harcourt',
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
    id: 'creek-facade',
    title: 'Creek-facing facade',
    location: 'Woji, Port Harcourt',
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
    id: 'lilac-lounge-gra',
    title: 'The lilac lounge',
    location: 'GRA Phase 2, Port Harcourt',
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
    location: 'Rumuokoro, Port Harcourt',
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
    location: 'Rumuola, Port Harcourt',
    year: '2025',
    stage: 'completed',
    kind: 'Boundary & gate',
    summary:
      'A turquoise boundary wall with black steel spikes, stone-white render and rusticated brick piers.',
    story: [
      'A boundary wall is the largest painted surface most Port Harcourt homes own, and the one most often left grey. This one was specified in a saturated outdoor blue that holds its colour under UV.',
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
    location: 'Concept — GRA, Port Harcourt',
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
  {
    id: 'brick-stone-pier-wall',
    title: 'Stone-brick pier wall',
    location: 'Port Harcourt, Rivers State',
    year: '2025',
    stage: 'completed',
    kind: 'Boundary & gate',
    summary:
      'A boundary wall and double gate finished with a stone-effect brick cladding on the piers, white-capped and paired with a black wrought-iron gate.',
    story: [
      'The entrance piers carry a stone-effect brick finish in a warm red-brown, each capped with a plain white band, flanking a black double gate with scrollwork cresting. A bungalow with a white portico sits behind the gate.',
      'A second pier a few streets away, photographed three days later, shows the same red-brick finish run alongside a plain grey rendered panel — a reminder that this stone-effect cladding is usually one material among several on a single elevation, not the whole wall.',
    ],
    cover: 'project-brick-gate',
    gallery: ['project-brick-gate', 'project-stone-pier'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'A stone-effect pier reads as masonry even where the rest of the wall is plain render.',
  },
  {
    id: 'scaffold-to-finish-elevation',
    title: 'Scaffold to finished elevation',
    location: 'Port Harcourt, Rivers State',
    year: '2023',
    stage: 'completed',
    kind: 'Exterior',
    summary:
      'A two-storey elevation in white above a dusty mauve ground-floor band, photographed at four stages across one week: scaffold up, balcony detail, the gate at dusk, then the completed house.',
    story: [
      '13 December, mid-afternoon: the scaffold is still up and a painter is working the upper storey by hand, the mauve band already laid in on the ground floor beneath him; a second, wider shot from the same afternoon shows the finished boundary wall and gate alongside the scaffold, with the household dog visible through the railing.',
      '16 December, mid-afternoon: a closer shot of the entrance bay shows the balcony soffit and a pale cream wall still being finished, with dust sheets and a stepladder on site.',
      '16 December, early evening: the same elevation from the street, scaffold still up on the first floor but the ground floor and gate already reading as complete.',
      '19 December: the finished elevation, scaffold down — white above, dusty mauve below, with a brick-effect pier picked out at first floor and a charcoal roof over all of it.',
    ],
    cover: 'project-mauve-finished',
    gallery: [
      'project-mauve-scaffold',
      'project-mauve-wall-dog',
      'project-mauve-balcony',
      'project-mauve-gate-dusk',
      'project-mauve-finished',
    ],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Photographing the same elevation at each stage is the plainest way to show a paint job is real.',
  },
  {
    id: 'gallery-corridor-interior',
    title: 'The gallery corridor',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'completed',
    kind: 'Interior',
    summary:
      'A stairwell and an adjoining hallway, both finished in plain white and hung edge to edge with framed artwork, with dark tile underfoot.',
    story: [
      'The stairwell walls are kept flat white so a run of framed paintings reads clearly against them; the handrail is wrapped for protection, which suggests other work was still under way nearby.',
      'The hallway continues the same white wall and dark floor strip, lined on both sides with more framed pieces — plain backgrounds doing the work of a gallery wall rather than a corridor.',
    ],
    cover: 'interior-gallery-hall',
    gallery: ['interior-gallery-stair', 'interior-gallery-hall'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Plain white walls are what let a hung collection read as a gallery rather than clutter.',
  },
  {
    id: 'commercial-facade-fitout',
    title: 'Commercial facade in progress',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A multi-storey commercial building mid fit-out, faced in grey and white composite cladding panels with bamboo scaffold still up on the street elevation.',
    story: [
      'Unlike the house projects on this page, this elevation is being finished in composite cladding panels rather than painted render — included here because it is part of the same site record and shows the scale some of this work reaches.',
    ],
    cover: 'project-commercial-cladding',
    gallery: ['project-commercial-cladding'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Cladding and painted render age differently side by side — worth planning for at the design stage, not after.',
  },
  {
    id: 'grey-stone-wall-gate',
    title: 'Grey stone-pattern boundary wall',
    location: 'Port Harcourt, Rivers State',
    year: '2025',
    stage: 'completed',
    kind: 'Boundary & gate',
    summary:
      'A boundary wall cast with a grey stone-block pattern and dark bronze-effect piers, capped in white under an arched wrought-iron gate, with the house behind faced in matching pale stone tile.',
    story: [
      'Two photographs of the same wall taken minutes apart: the gate end, with the bungalow\u2019s tiled gable and portico columns visible beyond it, and a second stretch of plain wall further along, still stacked with aggregate from the build.',
      'The grey stone-block texture and dark pier finish are carried right along the boundary, not just at the entrance, which is what makes the gate feel part of the wall rather than bolted onto it.',
    ],
    cover: 'project-grey-stone-gate',
    gallery: ['project-grey-stone-gate', 'project-grey-stone-pier'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Carry a textured finish past the gate and along the wall — stopping it at the piers looks unfinished.',
  },
  {
    id: 'cream-elevation-scaffold',
    title: 'Cream elevation under scaffold',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A cream rendered elevation still on bamboo scaffold, with a stone-tile accent panel being fitted beneath the windows and a charcoal roof already in place.',
    story: [
      'The roof and window frames are finished first; the wall colour and the stone-tile accent strip are still being brought up to meet them, which is the usual order of work on an exterior.',
    ],
    cover: 'project-cream-render-scaffold',
    gallery: ['project-cream-render-scaffold'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Roof and frames go in first; the body colour is brought up to meet them, not the other way round.',
  },
  {
    id: 'modern-grey-duplex',
    title: 'Modern grey duplex',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'completed',
    kind: 'Exterior',
    summary:
      'A contemporary grey duplex with crisp white banding and a dark feature panel at first floor, electric-fence wire along the parapet, and a matching grey boundary wall with planted beds at its base.',
    story: [
      'The body colour is a flat mid-grey, broken up by white string-courses at each floor line and a near-black composite panel at the stair window — a plain, two-tone treatment rather than a patterned one.',
      'The boundary wall repeats the same grey and white banding at street level, with a run of young planting set into the base of the wall.',
    ],
    cover: 'project-grey-duplex',
    gallery: ['project-grey-duplex', 'project-grey-duplex-wall'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Repeating the house colour on the boundary wall is what ties a plot together from the street.',
  },
  {
    id: 'pastel-interior-finish',
    title: 'Pastel interior finish',
    location: 'Port Harcourt, Rivers State',
    year: '2025',
    stage: 'in progress',
    kind: 'Interior',
    summary:
      'An open-plan room finished in pale yellow with raised panel moulding, photographed at three stages: an early shot before the skirting was fitted, then with the marble floor still sheeted for protection, then once the glazed sliding door and skirting were in.',
    story: [
      '6 April: the walls and ceiling cove are already finished in pale yellow and white, but the marble floor is still bare of skirting and a trestle stands in the middle of the room.',
      'A later, undated photograph shows the floor under plastic sheeting with off-cuts from the flooring stacked against the wall — the wall colour and panel moulding are already finished at this point.',
      'By the most recent photograph the protective sheeting is gone, a black-framed glazed sliding door has been hung on a barn-door track, and a ceiling-mounted camera has gone in — the room read as substantially finished but not yet handed over.',
    ],
    cover: 'interior-pastel-door',
    gallery: ['interior-pastel-early', 'interior-pastel-marble', 'interior-pastel-door'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Paint and moulding are usually finished well before the floor protection comes up — photograph both stages, not just the reveal.',
  },
  {
    id: 'arched-bungalow-portico',
    title: 'Arched bungalow portico',
    location: 'Port Harcourt, Rivers State',
    year: '2025',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A single-storey house finished in cream above a taupe plinth band, with a hipped roof and a triple-arched portico carried on fluted white columns.',
    story: [
      'The body colour and plinth band are already finished, and the portico columns and arches are painted crisp white against the cream wall behind them. Two window frames are still lying on the ground beside the porch, not yet glazed and fitted.',
    ],
    cover: 'project-arched-bungalow',
    gallery: ['project-arched-bungalow'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Painting the columns a shade lighter than the wall is what makes an arched portico read as a feature rather than a frame.',
  },
  {
    id: 'teal-duplex-urns',
    title: 'Teal-banded duplex',
    location: 'Port Harcourt, Rivers State',
    year: '2025',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A contemporary duplex in white and dark charcoal with a teal band at first floor, a glazed balcony balustrade, and white stone-effect urns flanking the entrance steps.',
    story: [
      '13 April: two men finish rendering the white entrance bay beside the charcoal pier, with building sand still bagged on the ground and the urns already in place either side of the steps.',
      '24 April: the rear courtyard is paved and the garage wall across it is finished in white, though a ladder is still up against the outbuilding roof and the planting beds are freshly dug.',
    ],
    cover: 'project-teal-duplex-entrance',
    gallery: [
      'project-teal-duplex-entrance',
      'project-teal-duplex-render',
      'project-teal-duplex-urn',
      'project-teal-duplex-courtyard',
    ],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'A single accent band at one floor line is enough to lift a grey-and-white elevation without it looking stripy.',
  },
  {
    id: 'ornate-dormer-elevation',
    title: 'Ornate dormer elevation',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A two-storey house in pale cream with a multi-gabled dark roof, a dormer window, and a vertical stone-tile accent pier beside an arched, stone-surrounded doorway.',
    story: [
      'The roof, cornice and window trims are finished, and the stone-tile pier is in; the boundary wall in front is still bare block capped with steel anti-climb spikes, and building sand is still on the ground. A near-identical tower on the plot next door is at the same stage of construction.',
    ],
    cover: 'project-dormer-elevation',
    gallery: ['project-dormer-elevation', 'project-dormer-elevation-side'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'A single stone-tile pier against a plain cream wall reads as a deliberate feature, not a patch.',
  },
  {
    id: 'powder-blue-portico-occasion',
    title: 'Powder-blue portico, dressed for an occasion',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A grand white portico on round columns over a powder-blue ground floor, photographed with balloon bunting strung along the upper balcony and a painter still finishing the porch ceiling from a scaffold tower.',
    story: [
      'The powder-blue and white colour scheme is complete across the visible elevation; the only work still under way is a painter touching in the underside of the porch roof from a mobile scaffold, with an ornamental pine in the foreground and a high-rise under construction next door.',
    ],
    cover: 'project-portico-event',
    gallery: ['project-portico-event'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'Powder-blue and white reads as celebratory without needing a stronger colour.',
  },
  {
    id: 'commercial-render-aircon',
    title: 'Commercial render with glazing',
    location: 'Port Harcourt, Rivers State',
    year: 'Undated',
    stage: 'in progress',
    kind: 'Exterior',
    summary:
      'A multi-storey commercial building finished in grey render with white window surrounds and blue-tinted glazing, external air-conditioning units already mounted, and bamboo scaffold still up on one corner.',
    story: [
      'Unlike the composite-clad commercial block photographed separately for this site record, this building is finished in painted render rather than cladding panels — included here because it shows a different commercial finish within the same street record.',
    ],
    cover: 'project-commercial-aircon',
    gallery: ['project-commercial-aircon'],
    colorIds: [],
    productIds: [],
    paletteId: '',
    takeaway: 'White trim around dark glazing is a cheap way to keep a plain grey render from reading as unfinished.',
  },
]

export const findProject = (id: string) => PROJECTS.find((p) => p.id === id)

export const STAGE_LABEL: Record<Stage, string> = {
  completed: 'Completed',
  'in progress': 'In progress',
  concept: 'Concept',
}
