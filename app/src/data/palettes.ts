/**
 * Curated palettes. Each palette is an editorial opinion, not an automatic
 * generation: a named colour story that a designer can defend in a client
 * meeting. Colours are referenced by id from `colors.ts` so a palette can never
 * drift out of sync with the colour library.
 */

export type Palette = {
  id: string
  name: string
  season: string
  /** ids from COLORS — first entry is the lead colour */
  colors: string[]
  /** role of each colour, in the same order as `colors` */
  roles: string[]
  story: string
  bestFor: string
  image: string
}

export const PALETTES: Palette[] = [
  {
    id: 'bonny-evening',
    name: 'Bonny Evening',
    season: 'The Delta Edit',
    colors: ['atlantic-blue', 'bone', 'opuda-white', 'golden-hour'],
    roles: ['Feature wall', 'Main walls', 'Ceilings & trim', 'Accent'],
    story:
      'A river-facing living room at dusk: deep Atlantic on the wall behind the seating, bone on the remaining walls so the room still reads as light, and a single golden accent on the joinery.',
    bestFor: 'Living rooms with west-facing glazing',
    image: 'project-finished-villa',
  },
  {
    id: 'harmattan-haze',
    name: 'Harmattan Haze',
    season: 'Harmattan',
    colors: ['savannah-sand', 'clay-beige', 'espresso', 'opuda-white'],
    roles: ['Main walls', 'Lower band', 'Trim & doors', 'Ceilings'],
    story:
      'The whole palette of December: dust-warm sand on the walls, a deeper clay dado, espresso on the doors and pure white ceilings to keep the light bouncing.',
    bestFor: 'Open-plan interiors with timber furniture',
    image: 'project-cream-scaffold',
  },
  {
    id: 'lilac-lounge',
    name: 'Lilac Lounge',
    season: 'The Delta Edit',
    colors: ['lilac-room', 'dusty-grape', 'opuda-white', 'pebble'],
    roles: ['Main walls', 'Feature alcove', 'Ceilings & cornice', 'Floor tone reference'],
    story:
      'Taken directly from a finished OPUDA’S job in GRA Phase 2, Port Harcourt: lilac across the main walls, a deeper grape in the recessed alcove, and white cornices doing the structural work.',
    bestFor: 'Bedrooms and small lounges',
    image: 'interior-lilac-lounge',
  },
  {
    id: 'peach-corridor',
    name: 'Peach Corridor',
    season: 'Harmattan',
    colors: ['apricot-wall', 'coral-dust', 'coconut-milk', 'mauve-linen'],
    roles: ['Corridor walls', 'Recess', 'Ceilings', 'Adjoining room'],
    story:
      'A warm corridor that borrows light from the room beyond it — apricot on the long walls, coral in the deep recess, and a mauve transition room you glimpse at the end.',
    bestFor: 'Corridors, stairwells and circulation with no daylight',
    image: 'interior-mauve-peach',
  },
  {
    id: 'rain-season-green',
    name: 'Rain Season',
    season: 'Rain Season',
    colors: ['palm-shadow', 'sage-whisper', 'bone', 'bronze-patina'],
    roles: ['Lower walls', 'Upper walls', 'Ceilings', 'External joinery'],
    story:
      'A green that behaves like a neutral. Palm Shadow anchors the lower wall, Sage Whisper lifts the upper wall, and Bronze Patina ties the exterior metalwork to the garden.',
    bestFor: 'Rooms with a garden view, studies and libraries',
    image: 'project-painter',
  },
  {
    id: 'plum-study',
    name: 'Plum Study',
    season: 'The Signature',
    colors: ['plum-velvet', 'aubergine', 'mushroom', 'opuda-white'],
    roles: ['Feature wall', 'Returns & reveals', 'Adjoining walls', 'Ceilings & trim'],
    story:
      'A study built for evening use: saturated plum on the wall you face, aubergine in the reveals so the colour continues when the door is open, and mushroom elsewhere to keep it calm.',
    bestFor: 'Studies, media rooms and libraries',
    image: 'render-modern-grey',
  },
  {
    id: 'terracotta-court',
    name: 'Terracotta Court',
    season: 'Harmattan',
    colors: ['terracotta', 'limestone', 'brick-lane', 'window-black'],
    roles: ['Main facade', 'Render and trims', 'Plinth band', 'Frames & gates'],
    story:
      'A courtyard elevation that has to work in strong sun: terracotta body, limestone bands to stop it overheating, a brick-red plinth, and black frames for crispness.',
    bestFor: 'Facades, boundary walls and gatehouses',
    image: 'project-finished-villa',
  },
  {
    id: 'blue-fence',
    name: 'Blue Fence',
    season: 'The Delta Edit',
    colors: ['blue-fence', 'stone-white', 'slate-grey', 'window-black'],
    roles: ['Boundary wall', 'Facade', 'Piers', 'Fence & gate'],
    story:
      'The turquoise boundary wall seen on an estate in Rumuola, paired with stone-white render and black steel so the blue reads as a deliberate architectural decision rather than a whim.',
    bestFor: 'Exteriors and boundary walls',
    image: 'project-blue-fence',
  },
  {
    id: 'quiet-luxury',
    name: 'Quiet Luxury',
    season: 'The Signature',
    colors: ['mushroom', 'taupe-drift', 'bronze-dust', 'ivory-coast'],
    roles: ['Main walls', 'Feature', 'Trim detail', 'Ceilings'],
    story:
      'Four neutrals and no colour, relying entirely on depth and reflectivity. This is the palette specifiers come back to when a client says "nothing too strong".',
    bestFor: 'Speculative developments and rentals',
    image: 'project-porch-blue',
  },
]

export const findPalette = (id: string) => PALETTES.find((p) => p.id === id)
