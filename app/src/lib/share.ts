/**
 * Durable project links (roadmap 11.02.05).
 *
 * The project board lives in local storage, which is the right place for a
 * device and the wrong place for a conversation: "send me what you picked"
 * cannot be answered with a storage key. So the board can be serialised into a
 * URL. No backend, no account, no personal data — the link *is* the state, and
 * anybody who has it can read it, which is why it carries colour codes and
 * quantities and nothing else.
 *
 * The encoding is compact JSON in base64url, and decoding is defensive to the
 * point of paranoia: a shared link is untrusted input from the address bar, so
 * every field is type-checked, bounded and matched against the real data before
 * it reaches a component.
 */
import { COLORS } from '../data/colors'
import { PRODUCTS } from '../data/products'
import { PREP_SITUATIONS } from '../data/tools'
import type { SavedEstimate } from './advisor'

export const SHARE_PARAM = 's'
export const SHARE_PATH = '/project'

/** Schema version, so a link from an older build can be refused politely. */
const VERSION = 1

const LIMITS = {
  name: 60,
  colours: 24,
  products: 12,
  estimates: 12,
  prep: 6,
} as const

export type SharedProject = {
  name: string
  colours: string[]
  products: string[]
  estimates: SavedEstimate[]
  prep: string[]
}

type WireEstimate = [string, string, string, string, number, 'L' | 'kg', number, number]

const colourIds = new Set(COLORS.map((colour) => colour.id))
const productIds = new Set(PRODUCTS.map((product) => product.id))
const prepIds = new Set(PREP_SITUATIONS.map((situation) => situation.id))

const finite = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null

/**
 * base64url over UTF-8.
 *
 * `btoa`/`atob` are globals in every browser this site supports and in Node 16+,
 * which is what the prerender runs on — so no Buffer, no dependency, and no
 * Latin-1 truncation of a project named in a language that needs more than one
 * byte per character.
 */
const toBase64Url = (json: string): string => {
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (token: string): string | null => {
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function encodeProject(project: SharedProject): string {
  const wire = {
    v: VERSION,
    n: project.name.slice(0, LIMITS.name),
    c: project.colours.filter((id) => colourIds.has(id)).slice(0, LIMITS.colours),
    p: project.products.filter((id) => productIds.has(id)).slice(0, LIMITS.products),
    s: project.prep.filter((id) => prepIds.has(id)).slice(0, LIMITS.prep),
    e: project.estimates
      .slice(0, LIMITS.estimates)
      .map<WireEstimate>((estimate) => [
        estimate.id.slice(0, 40),
        estimate.productId.slice(0, 40),
        estimate.label.slice(0, 60),
        estimate.packs.slice(0, 80),
        estimate.litres,
        estimate.unit === 'kg' ? 'kg' : 'L',
        estimate.area,
        estimate.coats,
      ]),
  }
  return toBase64Url(JSON.stringify(wire))
}

/**
 * Decode and validate a shared token. Returns `null` when the token is not one
 * of ours, so the caller can say "this link is not valid" instead of rendering
 * somebody's half-parsed board.
 */
export function decodeProject(token: string | null): SharedProject | null {
  if (!token) return null
  const json = fromBase64Url(token)
  if (!json) return null
  let wire: unknown
  try {
    wire = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof wire !== 'object' || wire === null) return null
  const record = wire as Record<string, unknown>
  if (record.v !== VERSION) return null

  const colours = Array.isArray(record.c)
    ? record.c.filter((id): id is string => typeof id === 'string' && colourIds.has(id)).slice(0, LIMITS.colours)
    : []
  const products = Array.isArray(record.p)
    ? record.p.filter((id): id is string => typeof id === 'string' && productIds.has(id)).slice(0, LIMITS.products)
    : []
  const prep = Array.isArray(record.s)
    ? record.s.filter((id): id is string => typeof id === 'string' && prepIds.has(id)).slice(0, LIMITS.prep)
    : []

  const estimates: SavedEstimate[] = []
  if (Array.isArray(record.e)) {
    for (const entry of record.e.slice(0, LIMITS.estimates)) {
      if (!Array.isArray(entry)) continue
      const [id, productId, label, packs, litres, unit, area, coats] = entry as unknown[]
      if (typeof id !== 'string' || typeof productId !== 'string') continue
      if (!productIds.has(productId)) continue
      const safeLitres = finite(litres, 0, 100_000)
      const safeArea = finite(area, 0, 100_000)
      const safeCoats = finite(coats, 0, 12)
      if (safeLitres === null || safeArea === null || safeCoats === null) continue
      estimates.push({
        id: id.slice(0, 40),
        productId: productId.slice(0, 40),
        label: typeof label === 'string' ? label.slice(0, 60) : 'Room',
        packs: typeof packs === 'string' ? packs.slice(0, 80) : '',
        litres: safeLitres,
        unit: unit === 'kg' ? 'kg' : 'L',
        area: safeArea,
        coats: Math.round(safeCoats),
        savedAt: 0,
      })
    }
  }

  if (!colours.length && !products.length && !estimates.length) return null

  return {
    name: typeof record.n === 'string' ? record.n.slice(0, LIMITS.name) : 'Shared project',
    colours,
    products,
    estimates,
    prep,
  }
}

/** The absolute link for a project. `origin` defaults to the current one. */
export function projectUrl(project: SharedProject, origin?: string | undefined): string {
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin)
  return `${base}${SHARE_PATH}?${SHARE_PARAM}=${encodeProject(project)}`
}
