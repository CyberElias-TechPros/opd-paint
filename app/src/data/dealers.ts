/**
 * Dealer network.
 *
 * DATA STATUS — this is a representative network built from the company's
 * trading areas, not a verified directory. Every entry carries `verified`.
 * Unverified entries render with a "call ahead to confirm stock" note, because
 * sending a customer across Port Harcourt to an empty shelf costs more trust
 * than an honest phone number. Replace this file with the dealer export from
 * the commercial team before launch (roadmap 10.06.10).
 *
 * Phone numbers all route to the brand line printed on the label
 * (0902 642 4350) until each dealer's direct line is confirmed.
 */

export type Dealer = {
  id: string
  name: string
  kind: 'Brand trade counter' | 'Authorised dealer' | 'Distributor'
  area: string
  city: string
  state: string
  lat: number
  lng: number
  services: Array<'Retail' | 'Trade pricing' | 'Colour mixing' | 'Delivery' | 'Sample pots' | 'Site visit'>
  verified: boolean
  hours: string
}

export const BRAND_PHONE_DISPLAY = '0902 642 4350'
export const BRAND_PHONE_TEL = '+2349026424350'
export const WHATSAPP_NUMBER = '2349026424350'

export const DEALERS: Dealer[] = [
  {
    id: 'ph-trans-amadi',
    name: "OPUDA'S Trade Counter — Port Harcourt",
    kind: 'Brand trade counter',
    area: 'Trans Amadi',
    city: 'Port Harcourt',
    state: 'Rivers',
    lat: 4.805,
    lng: 7.04,
    services: ['Retail', 'Trade pricing', 'Colour mixing', 'Sample pots', 'Site visit'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
  {
    id: 'ph-gra',
    name: "Authorised dealer — GRA Phase 2",
    kind: 'Authorised dealer',
    area: 'GRA Phase 2',
    city: 'Port Harcourt',
    state: 'Rivers',
    lat: 4.806,
    lng: 7.003,
    services: ['Retail', 'Delivery', 'Sample pots'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
  {
    id: 'ph-rumuokoro',
    name: "Authorised dealer — Rumuokoro",
    kind: 'Authorised dealer',
    area: 'Rumuokoro',
    city: 'Port Harcourt',
    state: 'Rivers',
    lat: 4.87,
    lng: 6.93,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–17:30',
  },
  {
    id: 'ph-woji',
    name: "Authorised dealer — Woji",
    kind: 'Authorised dealer',
    area: 'Woji',
    city: 'Port Harcourt',
    state: 'Rivers',
    lat: 4.823,
    lng: 7.047,
    services: ['Retail', 'Sample pots'],
    verified: false,
    hours: 'Mon–Sat, 8:30–17:00',
  },
  {
    id: 'ph-elelenwo',
    name: "Authorised dealer — Elelenwo",
    kind: 'Authorised dealer',
    area: 'Elelenwo',
    city: 'Port Harcourt',
    state: 'Rivers',
    lat: 4.844,
    lng: 7.033,
    services: ['Retail', 'Delivery'],
    verified: false,
    hours: 'Mon–Sat, 9:00–17:00',
  },
  {
    id: 'bonny',
    name: "Distributor — Bonny Island",
    kind: 'Distributor',
    area: 'Bonny Main Town',
    city: 'Bonny',
    state: 'Rivers',
    lat: 4.432,
    lng: 7.17,
    services: ['Retail', 'Delivery', 'Site visit'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
  },
  {
    id: 'uyo',
    name: "Authorised dealer — Uyo",
    kind: 'Authorised dealer',
    area: 'Ewet Housing',
    city: 'Uyo',
    state: 'Akwa Ibom',
    lat: 5.0377,
    lng: 7.9128,
    services: ['Retail', 'Delivery', 'Site visit'],
    verified: false,
    hours: 'Mon–Fri, 8:00–17:00',
  },
  {
    id: 'calabar',
    name: "Distributor — Calabar",
    kind: 'Distributor',
    area: 'Marian',
    city: 'Calabar',
    state: 'Cross River',
    lat: 4.9757,
    lng: 8.3417,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–17:30',
  },
  {
    id: 'warri',
    name: "Distributor — Warri",
    kind: 'Distributor',
    area: 'Effurun',
    city: 'Warri',
    state: 'Delta',
    lat: 5.5173,
    lng: 5.7506,
    services: ['Retail', 'Trade pricing', 'Colour mixing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
  {
    id: 'benin',
    name: "Authorised dealer — Benin City",
    kind: 'Authorised dealer',
    area: 'Ugbowo',
    city: 'Benin City',
    state: 'Edo',
    lat: 6.335,
    lng: 5.6037,
    services: ['Retail', 'Delivery'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
  },
  {
    id: 'owerri',
    name: "Authorised dealer — Owerri",
    kind: 'Authorised dealer',
    area: 'New Owerri',
    city: 'Owerri',
    state: 'Imo',
    lat: 5.4836,
    lng: 7.0332,
    services: ['Retail', 'Sample pots'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
  },
  {
    id: 'aba',
    name: "Distributor — Aba",
    kind: 'Distributor',
    area: 'Ariaria',
    city: 'Aba',
    state: 'Abia',
    lat: 5.1066,
    lng: 7.3667,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–17:30',
  },
  {
    id: 'abuja',
    name: "Distributor — Abuja",
    kind: 'Distributor',
    area: 'Wuse 2',
    city: 'Abuja',
    state: 'FCT',
    lat: 9.0765,
    lng: 7.4697,
    services: ['Retail', 'Trade pricing', 'Delivery', 'Site visit'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
  {
    id: 'lagos',
    name: "Distributor — Lagos",
    kind: 'Distributor',
    area: 'Ikeja GRA',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.6018,
    lng: 3.3515,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
]

export const STATES = [...new Set(DEALERS.map((d) => d.state))].sort()
export const SERVICES = [...new Set(DEALERS.flatMap((d) => d.services))].sort()

/** Great-circle distance in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10
}

export const directionsUrl = (dealer: Dealer) =>
  `https://www.google.com/maps/dir/?api=1&destination=${dealer.lat},${dealer.lng}`
