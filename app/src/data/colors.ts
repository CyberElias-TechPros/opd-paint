import { estimateLrv } from '../lib/color'

/**
 * The OPUDA'S PAINT colour library.
 *
 * PROVENANCE — read before editing.
 * • `hex` is the single source of truth for what the interface paints. Every
 *   swatch, room preview and PDF draws from this one value.
 * • Names and codes are the commercial identifiers. Changing a code breaks
 *   links, saved projects and dealer references, so treat codes as permanent.
 * • LRV is *derived* from the hex at runtime (`estimateLrv`) and labelled as an
 *   estimate. When a spectrophotometer reading of a dried film exists, add it
 *   as `measuredLrv` and the interface will prefer the measured value.
 * • This library is the launch set. It is deliberately small enough to be
 *   verified against physical fan-deck chips before release (roadmap 06.02).
 */

export type Family =
  | 'White & Off-White'
  | 'Warm Neutral'
  | 'Green'
  | 'Blue'
  | 'Terracotta & Red'
  | 'Yellow & Ochre'
  | 'Purple & Mauve'
  | 'Grey'
  | 'Deep & Architectural'

export type Undertone = 'Warm' | 'Cool' | 'Neutral'
export type Room = 'Living' | 'Bedroom' | 'Kitchen' | 'Bathroom' | 'Children' | 'Office' | 'Exterior' | 'Ceiling'

export type PaintColor = {
  id: string
  /** Dealer / fan-deck code. Permanent. */
  code: string
  name: string
  hex: string
  family: Family
  undertone: Undertone
  rooms: Room[]
  collection: string
  /** Short editorial note shown on the colour detail page. */
  note: string
  measuredLrv?: number
  /** Where the digital value came from — surfaced in the style guide. */
  source?: string
}

const c = (color: PaintColor): PaintColor => ({ source: 'OPUDA’S launch fan deck (digital proof)', ...color })

export const COLORS: PaintColor[] = [
  // ---------------------------------------------------------------- whites
  c({ id: 'opuda-white', code: 'OP-001', name: 'Opuda White', hex: '#F8F5EE', family: 'White & Off-White', undertone: 'Neutral', rooms: ['Ceiling', 'Living', 'Exterior'], collection: 'The Signature', note: 'Our brightest interior white. The default ceiling white across the range, and the one most painters cut in with.' }),
  c({ id: 'coconut-milk', code: 'OP-004', name: 'Coconut Milk', hex: '#F3EDE1', family: 'White & Off-White', undertone: 'Warm', rooms: ['Living', 'Bedroom', 'Ceiling'], collection: 'The Signature', note: 'A half-strength warm white that keeps large rooms from feeling clinical under LED lighting.' }),
  c({ id: 'limestone', code: 'OP-008', name: 'Limestone', hex: '#EBE4D5', family: 'White & Off-White', undertone: 'Warm', rooms: ['Living', 'Bedroom', 'Office'], collection: 'The Signature', note: 'The colour of the plaster in half the estates we paint. Works as a whole-house base you can layer colour onto.' }),
  c({ id: 'bone', code: 'OP-010', name: 'Bone', hex: '#E6DFCF', family: 'White & Off-White', undertone: 'Warm', rooms: ['Living', 'Bedroom', 'Exterior'], collection: 'The Signature', note: 'Slightly deeper than Limestone; holds its own next to dark timber and bronze detailing.' }),
  c({ id: 'ivory-coast', code: 'OP-012', name: 'Ivory Coast', hex: '#F0E8D6', family: 'White & Off-White', undertone: 'Warm', rooms: ['Living', 'Bedroom'], collection: 'The Lagos Edit', note: 'A sun-warmed ivory that photographs beautifully in north-facing rooms.' }),
  c({ id: 'cotton-paper', code: 'OP-016', name: 'Cotton Paper', hex: '#E2DCD0', family: 'White & Off-White', undertone: 'Neutral', rooms: ['Ceiling', 'Bedroom'], collection: 'The Signature', note: 'A soft, low-shine white for cornices and bulkheads where you want separation without contrast.' }),
  c({ id: 'stone-white', code: 'OP-020', name: 'Stone White', hex: '#EEEEEA', family: 'White & Off-White', undertone: 'Cool', rooms: ['Kitchen', 'Bathroom'], collection: 'The Signature', note: 'A cool, clean white that resists looking dingy against stainless steel and tiles.' }),

  // --------------------------------------------------------- warm neutrals
  c({ id: 'savannah-sand', code: 'OP-104', name: 'Savannah Sand', hex: '#DBC7A6', family: 'Warm Neutral', undertone: 'Warm', rooms: ['Living', 'Bedroom', 'Exterior'], collection: 'Harmattan', note: 'The colour of dust on a December afternoon. Warm without tipping into yellow.' }),
  c({ id: 'warm-oat', code: 'OP-108', name: 'Warm Oat', hex: '#D4C0A1', family: 'Warm Neutral', undertone: 'Warm', rooms: ['Living', 'Office'], collection: 'Harmattan', note: 'Reads as a soft beige on interiors and as a pale stone on rendered exteriors.' }),
  c({ id: 'clay-beige', code: 'OP-112', name: 'Clay Beige', hex: '#C6AA88', family: 'Warm Neutral', undertone: 'Warm', rooms: ['Living', 'Bedroom', 'Exterior'], collection: 'Harmattan', note: 'An earthy mid-tone that flatters terracotta, cane and dark wood furniture.' }),
  c({ id: 'desert-linen', code: 'OP-116', name: 'Desert Linen', hex: '#CCB498', family: 'Warm Neutral', undertone: 'Warm', rooms: ['Bedroom', 'Living'], collection: 'Harmattan', note: 'A quiet, textile-like neutral. Excellent for bedrooms that need to feel cool in the heat.' }),
  c({ id: 'mushroom', code: 'OP-120', name: 'Mushroom', hex: '#A69788', family: 'Warm Neutral', undertone: 'Neutral', rooms: ['Living', 'Office', 'Exterior'], collection: 'The Signature', note: 'A dependable grey-beige. Hides surface variation on older walls better than flat greys.' }),
  c({ id: 'taupe-drift', code: 'OP-124', name: 'Taupe Drift', hex: '#A3917C', family: 'Warm Neutral', undertone: 'Warm', rooms: ['Living', 'Bedroom'], collection: 'The Signature', note: 'Depth for feature walls without the commitment of a full colour.' }),
  c({ id: 'bronze-dust', code: 'OP-128', name: 'Bronze Dust', hex: '#8F7A62', family: 'Warm Neutral', undertone: 'Warm', rooms: ['Living', 'Exterior'], collection: 'The Signature', note: 'Sits between brass and clay — a strong companion for cream render and dark roofs.' }),
  c({ id: 'pebble', code: 'OP-132', name: 'Pebble', hex: '#A8A69C', family: 'Warm Neutral', undertone: 'Neutral', rooms: ['Living', 'Office', 'Exterior'], collection: 'The Signature', note: 'A calm stone grey that keeps architectural shadows legible.' }),
  c({ id: 'lagos-fog', code: 'OP-136', name: 'Lagos Fog', hex: '#C2C1B8', family: 'Warm Neutral', undertone: 'Cool', rooms: ['Living', 'Office', 'Ceiling'], collection: 'The Lagos Edit', note: 'Our hashtag colour: the soft grey-green of early-morning haze over the lagoon.' }),

  // ---------------------------------------------------------------- greens
  c({ id: 'opuda-green', code: 'OP-201', name: 'Opuda Green', hex: '#0C6B45', family: 'Green', undertone: 'Cool', rooms: ['Exterior', 'Living', 'Office'], collection: 'The Signature', note: 'The brand green, straight from the pail. Use it on feature walls, signage and railings.' }),
  c({ id: 'forest-floor', code: 'OP-205', name: 'Forest Floor', hex: '#2B4A37', family: 'Green', undertone: 'Cool', rooms: ['Living', 'Office', 'Exterior'], collection: 'The Signature', note: 'A deep, enveloping green that makes a large room feel like a library.' }),
  c({ id: 'palm-shadow', code: 'OP-209', name: 'Palm Shadow', hex: '#3E5C46', family: 'Green', undertone: 'Cool', rooms: ['Living', 'Bedroom'], collection: 'Rain Season', note: 'The cool green under the palms at 4pm. Pairs well with brass and rattan.' }),
  c({ id: 'eko-emerald', code: 'OP-213', name: 'Eko Emerald', hex: '#15734F', family: 'Green', undertone: 'Cool', rooms: ['Living', 'Office'], collection: 'The Lagos Edit', note: 'Brighter than the brand green — a strong single-wall choice behind dark shelving.' }),
  c({ id: 'moss-room', code: 'OP-217', name: 'Moss Room', hex: '#6B7B55', family: 'Green', undertone: 'Warm', rooms: ['Bedroom', 'Living'], collection: 'Rain Season', note: 'An olive-leaning green that behaves like a neutral in rooms with a lot of daylight.' }),
  c({ id: 'olive-branch', code: 'OP-221', name: 'Olive Branch', hex: '#7D7F4E', family: 'Green', undertone: 'Warm', rooms: ['Living', 'Kitchen'], collection: 'Rain Season', note: 'A dry, herbal green. Best in matt, where the texture reads as pigment rather than shine.' }),
  c({ id: 'sage-whisper', code: 'OP-225', name: 'Sage Whisper', hex: '#B9C1A7', family: 'Green', undertone: 'Warm', rooms: ['Bedroom', 'Children', 'Kitchen'], collection: 'Rain Season', note: 'A gentle herbal wash for bedrooms and children’s rooms. Very forgiving of uneven light.' }),
  c({ id: 'eucalyptus-mist', code: 'OP-229', name: 'Eucalyptus Mist', hex: '#CED7C8', family: 'Green', undertone: 'Cool', rooms: ['Bedroom', 'Bathroom', 'Ceiling'], collection: 'Rain Season', note: 'A pale green-grey for ceilings and small rooms that you want to feel taller.' }),

  // ----------------------------------------------------------------- blues
  c({ id: 'atlantic-blue', code: 'OP-301', name: 'Atlantic Blue', hex: '#1E4E6B', family: 'Blue', undertone: 'Cool', rooms: ['Living', 'Office', 'Exterior'], collection: 'The Lagos Edit', note: 'Serious, architectural navy. Used on doors and gates it reads almost black at dusk.' }),
  c({ id: 'lagoon', code: 'OP-305', name: 'Lagoon', hex: '#2C6E85', family: 'Blue', undertone: 'Cool', rooms: ['Living', 'Bathroom'], collection: 'Rain Season', note: 'A teal-leaning blue that stays cheerful in humid, low-contrast light.' }),
  c({ id: 'harmattan-sky', code: 'OP-309', name: 'Harmattan Sky', hex: '#A7BECD', family: 'Blue', undertone: 'Cool', rooms: ['Bedroom', 'Ceiling', 'Children'], collection: 'Harmattan', note: 'The bleached blue of a dusty December sky. The safest way to bring blue into a bedroom.' }),
  c({ id: 'powder-blue', code: 'OP-313', name: 'Powder Blue', hex: '#C2D2DD', family: 'Blue', undertone: 'Cool', rooms: ['Bedroom', 'Children', 'Bathroom'], collection: 'Harmattan', note: 'Soft, clean and slightly grey — reads as white in a bright room, as blue in a dark one.' }),
  c({ id: 'denim-room', code: 'OP-317', name: 'Denim Room', hex: '#566F8A', family: 'Blue', undertone: 'Cool', rooms: ['Living', 'Bedroom'], collection: 'The Signature', note: 'A mid blue like worn denim. Excellent behind white bedding and pale wood.' }),
  c({ id: 'indigo-night', code: 'OP-321', name: 'Indigo Night', hex: '#263050', family: 'Blue', undertone: 'Cool', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'A deep blue-violet for studies and media rooms where glow and reflection matter.' }),
  c({ id: 'blue-fence', code: 'OP-325', name: 'Blue Fence', hex: '#2F7FA8', family: 'Blue', undertone: 'Cool', rooms: ['Exterior'], collection: 'The Lagos Edit', note: 'A saturated outdoor blue taken from gates and fences across Lekki. Weather resistant in Silk.' }),

  // ----------------------------------------------------- terracotta & reds
  c({ id: 'terracotta', code: 'OP-401', name: 'Terracotta', hex: '#B4654A', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Living', 'Exterior'], collection: 'Harmattan', note: 'Fired-earth orange-red. Strong on rendered walls, calmer in matt interiors.' }),
  c({ id: 'clay-pot', code: 'OP-405', name: 'Clay Pot', hex: '#A9553C', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Living', 'Exterior'], collection: 'Harmattan', note: 'Deeper and browner than Terracotta — the colour of unglazed pots in a courtyard.' }),
  c({ id: 'brick-lane', code: 'OP-409', name: 'Brick Lane', hex: '#8C4533', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Exterior', 'Living'], collection: 'Harmattan', note: 'A grounded brick red for boundary walls, plinths and accent bands.' }),
  c({ id: 'coral-dust', code: 'OP-413', name: 'Coral Dust', hex: '#D08B72', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Bedroom', 'Children'], collection: 'Harmattan', note: 'A softened coral that flatters warm skin tones and photographs beautifully at golden hour.' }),
  c({ id: 'crimson-seal', code: 'OP-417', name: 'Crimson Seal', hex: '#A8101B', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Exterior', 'Living'], collection: 'The Signature', note: 'The red of the label brush stroke. Use sparingly, and always in Silk or Gloss outdoors.' }),
  c({ id: 'festival-red', code: 'OP-421', name: 'Festival Red', hex: '#C1121F', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Exterior'], collection: 'The Signature', note: 'A confident signboard red with genuine depth. Two coats over a grey primer, no shortcuts.' }),
  c({ id: 'rust-ember', code: 'OP-425', name: 'Rust Ember', hex: '#8A4A2B', family: 'Terracotta & Red', undertone: 'Warm', rooms: ['Living', 'Exterior'], collection: 'Harmattan', note: 'Burnt sienna. Warms concrete and grey tile better than any beige.' }),

  // -------------------------------------------------------- yellow & ochre
  c({ id: 'harmattan-sun', code: 'OP-501', name: 'Harmattan Sun', hex: '#E3B45F', family: 'Yellow & Ochre', undertone: 'Warm', rooms: ['Living', 'Children'], collection: 'Harmattan', note: 'A dusty gold, not a lemon. Strong in kitchens and hallways that get no morning light.' }),
  c({ id: 'ochre', code: 'OP-505', name: 'Ochre', hex: '#C58A3C', family: 'Yellow & Ochre', undertone: 'Warm', rooms: ['Living', 'Office'], collection: 'Harmattan', note: 'A pigment-rich ochre that behaves like an earth colour rather than a bright.' }),
  c({ id: 'golden-hour', code: 'OP-509', name: 'Golden Hour', hex: '#DAAF69', family: 'Yellow & Ochre', undertone: 'Warm', rooms: ['Bedroom', 'Living'], collection: 'Harmattan', note: 'The colour a west-facing room turns at 5:30pm. Beautiful in lamp light, softer by day.' }),
  c({ id: 'marigold', code: 'OP-513', name: 'Marigold', hex: '#DF9F2A', family: 'Yellow & Ochre', undertone: 'Warm', rooms: ['Children', 'Kitchen'], collection: 'Harmattan', note: 'Cheerful and saturated. Keep it to one wall, or use it on furniture and trim.' }),
  c({ id: 'apricot-wall', code: 'OP-517', name: 'Apricot Wall', hex: '#E8C3A1', family: 'Yellow & Ochre', undertone: 'Warm', rooms: ['Bedroom', 'Living'], collection: 'Harmattan', note: 'A gentle apricot that makes north-facing rooms feel warmed from within.' }),

  // ------------------------------------------------------- purple & mauve
  c({ id: 'aubergine', code: 'OP-601', name: 'Aubergine', hex: '#4A2B45', family: 'Purple & Mauve', undertone: 'Cool', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'A dark, serious plum. Almost black in corners, wine-red in daylight.' }),
  c({ id: 'lilac-room', code: 'OP-605', name: 'Lilac Room', hex: '#D1BFD5', family: 'Purple & Mauve', undertone: 'Cool', rooms: ['Bedroom', 'Children'], collection: 'The Lagos Edit', note: 'Taken from a finished lounge in Lekki Phase 1. Soft enough for a whole room, unusual enough to remember.' }),
  c({ id: 'plum-velvet', code: 'OP-609', name: 'Plum Velvet', hex: '#6B3FA3', family: 'Purple & Mauve', undertone: 'Cool', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'A true saturated purple for feature walls and doors. Demands good lighting.' }),
  c({ id: 'mauve-linen', code: 'OP-613', name: 'Mauve Linen', hex: '#C2A5AD', family: 'Purple & Mauve', undertone: 'Neutral', rooms: ['Bedroom', 'Living'], collection: 'The Lagos Edit', note: 'A dusty rose-mauve that works as a neutral with grey, cream and walnut.' }),
  c({ id: 'dusty-grape', code: 'OP-617', name: 'Dusty Grape', hex: '#8C6D85', family: 'Purple & Mauve', undertone: 'Cool', rooms: ['Bedroom', 'Living'], collection: 'The Signature', note: 'Muted, grown-up purple. Pairs with sage green and aged brass.' }),
  c({ id: 'blush-room', code: 'OP-621', name: 'Blush Room', hex: '#E6C8C0', family: 'Purple & Mauve', undertone: 'Warm', rooms: ['Bedroom', 'Children'], collection: 'Harmattan', note: 'A warm, skin-toned blush. The softest way to introduce colour to a small bedroom.' }),

  // ----------------------------------------------------------------- greys
  c({ id: 'graphite', code: 'OP-701', name: 'Graphite', hex: '#3A3F3C', family: 'Grey', undertone: 'Neutral', rooms: ['Living', 'Office', 'Exterior'], collection: 'The Signature', note: 'Our standard dark grey for gates, window frames, plinths and feature walls.' }),
  c({ id: 'slate-grey', code: 'OP-705', name: 'Slate Grey', hex: '#6A7371', family: 'Grey', undertone: 'Cool', rooms: ['Living', 'Exterior'], collection: 'The Signature', note: 'A cool architectural grey that reads blue-green in shade.' }),
  c({ id: 'morning-mist', code: 'OP-709', name: 'Morning Mist', hex: '#CACFCB', family: 'Grey', undertone: 'Cool', rooms: ['Ceiling', 'Bathroom', 'Office'], collection: 'The Signature', note: 'A clean, pale grey for ceilings and service rooms. Slightly green, never icy.' }),
  c({ id: 'charcoal-wall', code: 'OP-713', name: 'Charcoal Wall', hex: '#2A2E2B', family: 'Grey', undertone: 'Neutral', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'The darkest grey in the range. Use it where you want shadow, not colour.' }),
  c({ id: 'window-black', code: 'OP-717', name: 'Window Black', hex: '#1B1D1C', family: 'Grey', undertone: 'Neutral', rooms: ['Exterior'], collection: 'The Signature', note: 'A soft black for frames and ironwork — less harsh than a pure black under sunlight.' }),

  // ------------------------------------------------- deep & architectural
  c({ id: 'midnight-teal', code: 'OP-801', name: 'Midnight Teal', hex: '#14332F', family: 'Deep & Architectural', undertone: 'Cool', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'A near-black teal for studies and media walls. Give it two full coats.' }),
  c({ id: 'deep-ocean', code: 'OP-805', name: 'Deep Ocean', hex: '#1B3A50', family: 'Deep & Architectural', undertone: 'Cool', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'A dense blue that makes white joinery look crisp and deliberate.' }),
  c({ id: 'cocoa-brown', code: 'OP-809', name: 'Cocoa Brown', hex: '#593A2B', family: 'Deep & Architectural', undertone: 'Warm', rooms: ['Living', 'Office'], collection: 'The Signature', note: 'A warm brown that grounds a room without the heaviness of black.' }),
  c({ id: 'espresso', code: 'OP-813', name: 'Espresso', hex: '#3A2A22', family: 'Deep & Architectural', undertone: 'Warm', rooms: ['Living', 'Office', 'Exterior'], collection: 'The Signature', note: 'Deep coffee brown for timber-effect panels, doors and fascias.' }),
  c({ id: 'bronze-patina', code: 'OP-817', name: 'Bronze Patina', hex: '#6D7A62', family: 'Deep & Architectural', undertone: 'Warm', rooms: ['Exterior', 'Living'], collection: 'Rain Season', note: 'A green-bronze that mimics aged copper and weathered stone.' }),
]

export const FAMILIES: Family[] = [
  'White & Off-White',
  'Warm Neutral',
  'Green',
  'Blue',
  'Terracotta & Red',
  'Yellow & Ochre',
  'Purple & Mauve',
  'Grey',
  'Deep & Architectural',
]

export const ROOMS: Room[] = ['Living', 'Bedroom', 'Kitchen', 'Bathroom', 'Children', 'Office', 'Exterior', 'Ceiling']

export const COLLECTIONS = ['The Signature', 'The Lagos Edit', 'Harmattan', 'Rain Season'] as const

export const COLOR_LRV = (color: PaintColor): number => color.measuredLrv ?? estimateLrv(color.hex)

export const findColor = (id: string): PaintColor | undefined => COLORS.find((color) => color.id === id)

export const colorsByIds = (ids: string[]): PaintColor[] =>
  ids.map(findColor).filter((color): color is PaintColor => Boolean(color))

/** Family colour used for the little dot beside a filter label. */
export const FAMILY_SWATCH: Record<Family, string> = {
  'White & Off-White': '#F1EBDF',
  'Warm Neutral': '#C6AA88',
  Green: '#0C6B45',
  Blue: '#1E4E6B',
  'Terracotta & Red': '#B4654A',
  'Yellow & Ochre': '#C58A3C',
  'Purple & Mauve': '#8C6D85',
  Grey: '#6A7371',
  'Deep & Architectural': '#14332F',
}
