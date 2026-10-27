import manifest from '../../public/media/manifest.json'

export type MediaEntry = {
  src: string
  thumb: string
  width: number
  height: number
  aspect: number
  lqip: string
  tint: string
}

const MEDIA = manifest as Record<string, MediaEntry>

export type ImageAlt = string

/**
 * Descriptive alt text for every image that ships with the site. Alt text is
 * treated as content here rather than hard-coded in components, so it can be
 * reviewed in one place (roadmap 09.02.02).
 */
export const ALT: Record<string, string> = {
  'brand-banner-matt':
    "OPUDA'S PAINT advertising banner: the wordmark above a red brush stroke and a finished two-storey house, with the Matt product name and the 5-year guarantee seal.",
  'brand-banner-red':
    "OPUDA'S PAINT advertising artwork showing a brush lifting red paint from an open tin beside the OPUDA'S wordmark and the 5-year guarantee seal.",
  'brand-banner-tin': "OPUDA'S PAINT tin label artwork with the wordmark and product claims.",
  'product-matt-bucket':
    "A white 20-litre pail of OPUDA'S MATT paint resting on a second pail against a cream panelled wall. The label reads 'High quality, for walls and ceilings, smooth finish, better flow, extra coverage, anti-fungi additive, eco-friendly, weather resistance' and carries the phone number 0902 642 4350.",
  'product-matt-pail':
    "A pail of OPUDA'S MATT paint with the full label visible, showing the house-and-brush logo, the red brush stroke and the 5-year guarantee seal.",
  'product-silk-bucket':
    "A pail of OPUDA'S SILK paint on a wooden platform, with a paint-covered roller behind it on an interior site.",
  'product-silk-pail':
    "A close view of the OPUDA'S SILK pail, showing the white label, four-colour paint dots and the red brush stroke.",
  'project-finished-villa':
    'A completed two-storey house finished in warm off-white with grey pilasters, dark roof tiles, an arched entrance revealing a chandelier, and brick-edged boundary pillars in front.',
  'project-arched-facade':
    'The front elevation of a two-storey house finished in pale cream, with stone-clad piers, an arched balcony and scaffolding still in place.',
  'project-porch-blue':
    'A finished blue-grey house under a tall white porch column, with a painter working on a mobile scaffold in the foreground.',
  'project-cream-scaffold':
    'A cream-finished house elevation seen through bamboo scaffolding, with a painter applying the final coat around a window.',
  'project-corner-scaffold':
    'A corner view of a house under construction, its cream topcoat applied above grey render, with scaffolding wrapping the facade.',
  'project-dark-roof':
    'A large house with a steep charcoal roof, stone-clad columns and freshly painted cream walls, photographed before the scaffolding was struck.',
  'project-stone-brick':
    'A boundary wall in progress: rusticated terracotta block piers, grey render panels, white capping and a white string course.',
  'project-blue-fence':
    'A finished white and grey facade behind a turquoise spike fence and rendered boundary wall with brick piers.',
  'project-render-stage':
    'A house at render stage: bare grey screeded walls, white fascia bands, a dark roof and scaffolding across two elevations.',
  'project-painter':
    'A painter on scaffolding applying paint to a cream wall beside a window with patterned stone cladding.',
  'project-stone-wall':
    'A stone-clad boundary wall with white capping and a row of palms, painted in white and rusticated brick.',
  'project-gate':
    'A pair of black steel gates with gold detailing, set between rusticated brick piers capped in white.',
  'interior-lilac-lounge':
    'An interior lounge painted in lilac above and below the picture rail, with a deeper plum feature wall, a peach corridor beyond and terrazzo-look tiled floor.',
  'interior-mauve-peach':
    'An empty interior room with a mauve wall, a peach recessed alcove and warm pepper tones on the adjoining wall, before furnishing.',
  'render-modern-white':
    'An architectural render of a modern white house with dark vertical fins, timber cladding and a glass balcony.',
  'render-modern-grey':
    'An architectural render of a contemporary house in white and charcoal with timber screens and a paved forecourt.',
  'project-film-poster':
    'A frame from the OPUDA’S PAINT site film showing an interior being prepared for painting.',
  'project-brick-gate':
    'A boundary gate with red stone-effect brick piers capped in white, a black wrought-iron double gate with scrollwork, and a car parked in the driveway beyond.',
  'project-stone-pier':
    'A close view of a red stone-effect brick pier beside a plain grey rendered panel, both capped in white, with a palm tree in front.',
  'project-mauve-finished':
    'A finished two-storey house in white above a dusty mauve ground floor, with a brick-effect pier, charcoal roof tiles and a car in the driveway.',
  'project-mauve-scaffold':
    'A house elevation still on scaffolding, white above a mauve ground-floor band, with a painter working the upper storey by hand.',
  'project-mauve-balcony':
    'A close view of a house entrance bay with a curved balcony soffit over a mauve wall, a worker reaching up beside a stepladder.',
  'interior-gallery-stair':
    'A stairwell with plain white walls hung with framed paintings, a glass balustrade and dark tiled steps, the handrail wrapped for protection.',
  'interior-gallery-hall':
    'A narrow hallway in white with a dark floor strip, lined on both sides with framed artwork leading to a window at the far end.',
  'project-commercial-cladding':
    'A multi-storey commercial building under construction, faced in grey and white composite cladding panels with bamboo scaffold still up.',
  'project-grey-stone-gate':
    'A bungalow with a tiled gable and portico columns, seen behind a boundary wall cast in a grey stone-block pattern with dark bronze-effect piers and an arched iron gate.',
  'project-cream-render-scaffold':
    'A cream-rendered house elevation on bamboo scaffold, with a stone-tile accent panel being fitted beneath the windows under a finished charcoal roof.',
  'project-grey-duplex':
    'A contemporary grey duplex with white string-course banding, a dark feature panel at first floor and electric-fence wire along the parapet.',
  'project-grey-duplex-wall':
    'A grey and white banded boundary wall matching a duplex behind it, with a run of young planting set into the base of the wall.',
  'project-grey-stone-pier':
    'A stretch of boundary wall in the same grey stone-block pattern and dark pier finish as the gate, with aggregate still stacked beside it.',
  'interior-pastel-door':
    'A pale-yellow room with raised panel moulding and a marble floor, a black-framed glazed door hung on a barn-door track and a ceiling-mounted camera.',
  'interior-pastel-marble':
    'A pale-yellow open-plan room with a marble floor still under plastic sheeting and flooring off-cuts stacked against the wall.',
}

export function getImage(key: string): MediaEntry {
  const entry = MEDIA[key]
  if (!entry) {
    // Fail loud in development, degrade gracefully in production.
    if (import.meta.env.DEV) console.warn(`[media] unknown image key: ${key}`)
    return { src: '', thumb: '', width: 1, height: 1, aspect: 1, lqip: '', tint: '#e2d6c3' }
  }
  return entry
}

export const imageKeys = Object.keys(MEDIA)
