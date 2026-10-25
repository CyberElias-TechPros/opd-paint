/**
 * Dealer network.
 *
 * DATA STATUS — this is a representative network built from the company's
 * trading areas, not a verified directory. Every entry carries `verified`.
 * Unverified entries render with a "call ahead to confirm stock" note, because
 * sending a customer across Lagos to an empty shelf costs more trust than an
 * honest phone number. Replace this file with the dealer export from the
 * commercial team before launch (roadmap 10.06.10).
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
    id: 'lekki-phase-1',
    name: "OPUDA'S Trade Counter — Lekki",
    kind: 'Brand trade counter',
    area: 'Lekki Phase 1',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.4474,
    lng: 3.4723,
    services: ['Retail', 'Trade pricing', 'Colour mixing', 'Sample pots'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
  {
    id: 'ajah',
    name: 'Authorised dealer — Ajah',
    kind: 'Authorised dealer',
    area: 'Ajah',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.4667,
    lng: 3.5653,
    services: ['Retail', 'Delivery', 'Sample pots'],
    verified: true,
    hours: 'Mon–Sat, 8:00–17:30',
  },
  {
    id: 'ikeja',
    name: 'Authorised dealer — Ikeja',
    kind: 'Authorised dealer',
    area: 'Ikeja GRA',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.6018,
    lng: 3.3515,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–18:00',
  },
  {
    id: 'surulere',
    name: 'Authorised dealer — Surulere',
    kind: 'Authorised dealer',
    area: 'Surulere',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.4998,
    lng: 3.3506,
    services: ['Retail', 'Sample pots'],
    verified: false,
    hours: 'Mon–Sat, 8:30–17:00',
  },
  {
    id: 'yaba',
    name: 'Authorised dealer — Yaba',
    kind: 'Authorised dealer',
    area: 'Yaba',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.5095,
    lng: 3.3711,
    services: ['Retail', 'Colour mixing'],
    verified: false,
    hours: 'Mon–Sat, 9:00–17:00',
  },
  {
    id: 'ikorodu',
    name: 'Authorised dealer — Ikorodu',
    kind: 'Authorised dealer',
    area: 'Ikorodu',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.6194,
    lng: 3.5105,
    services: ['Retail', 'Delivery', 'Trade pricing'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
  },
  {
    id: 'festac',
    name: 'Authorised dealer — Festac',
    kind: 'Authorised dealer',
    area: 'Festac Town',
    city: 'Lagos',
    state: 'Lagos',
    lat: 6.4667,
    lng: 3.2833,
    services: ['Retail', 'Sample pots'],
    verified: false,
    hours: 'Mon–Sat, 8:30–17:30',
  },
  {
    id: 'abuja',
    name: 'Distributor — Abuja',
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
    id: 'ph',
    name: 'Distributor — Port Harcourt',
    kind: 'Distributor',
    area: 'Trans Amadi',
    city: 'Port Harcourt',
    state: 'Rivers',
    lat: 4.8156,
    lng: 7.0498,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: true,
    hours: 'Mon–Sat, 8:00–17:30',
  },
  {
    id: 'ibadan',
    name: 'Authorised dealer — Ibadan',
    kind: 'Authorised dealer',
    area: 'Bodija',
    city: 'Ibadan',
    state: 'Oyo',
    lat: 7.4296,
    lng: 3.9094,
    services: ['Retail', 'Sample pots', 'Delivery'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
  },
  {
    id: 'benin',
    name: 'Authorised dealer — Benin City',
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
    id: 'enugu',
    name: 'Authorised dealer — Enugu',
    kind: 'Authorised dealer',
    area: 'Independence Layout',
    city: 'Enugu',
    state: 'Enugu',
    lat: 6.4584,
    lng: 7.5464,
    services: ['Retail', 'Trade pricing'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
  },
  {
    id: 'uyo',
    name: 'Authorised dealer — Uyo',
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
    id: 'kano',
    name: 'Distributor — Kano',
    kind: 'Distributor',
    area: 'Nassarawa GRA',
    city: 'Kano',
    state: 'Kano',
    lat: 12.0022,
    lng: 8.592,
    services: ['Retail', 'Trade pricing', 'Delivery'],
    verified: false,
    hours: 'Mon–Sat, 8:00–17:00',
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
