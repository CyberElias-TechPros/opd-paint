/**
 * Content overrides — the thin layer that makes the typed data files
 * editable without touching TypeScript.
 *
 * Why this exists: the roadmap (`docs/remaining-work.md`, Phase 09) frames the
 * choice as "a headless CMS, or an admin CRUD layer over the typed data". A
 * full CMS needs a database and an editorial workflow this project does not
 * have. An admin layer over the *existing* typed files is cheaper, keeps every
 * content-integrity test working unchanged, and covers exactly the fields the
 * roadmap flags as provisional: dealer verification, product claim status and
 * pack availability, measured LRV, and guide review metadata.
 *
 * How it works: each override file below is committed JSON, read at import
 * time (synchronously, so it works identically in the browser, in SSR
 * prerendering and in Node scripts). `/admin/content` (see
 * `server/admin-content.mjs` and `server/content-store.mjs`) reads and writes
 * these same files through an authenticated API. A write takes effect the
 * next time the site is built — this is a static site, so an edit is a
 * content change, not a live database write. See `docs/admin.md` for the
 * full read/write story, including why writes are not guaranteed to persist
 * on a read-only serverless filesystem unless the GitHub-backed store is
 * configured.
 */
import dealerOverridesJson from '../data/overrides/dealers.json'
import productOverridesJson from '../data/overrides/products.json'
import colourOverridesJson from '../data/overrides/colours.json'
import guideOverridesJson from '../data/overrides/guides.json'

export type DealerOverrides = {
  edits: Record<string, Record<string, unknown>>
  additions: Array<Record<string, unknown>>
  removed: string[]
}

export type ProductOverrides = {
  claimsStatus: Record<string, 'label-verified' | 'pending-verification'>
  packInStock: Record<string, Record<string, boolean>>
}

export type ColourOverrides = {
  measuredLrv: Record<string, number>
}

export type GuideOverrides = {
  edits: Record<string, { reviewer?: string; updated?: string }>
}

export const dealerOverrides = dealerOverridesJson as DealerOverrides
export const productOverrides = productOverridesJson as ProductOverrides
export const colourOverrides = colourOverridesJson as ColourOverrides
export const guideOverrides = guideOverridesJson as GuideOverrides

/** Apply dealer edits/additions/removals on top of the typed base list. */
export function applyDealerOverrides<T extends { id: string }>(base: T[]): T[] {
  const removed = new Set(dealerOverrides.removed ?? [])
  const edited = base
    .filter((dealer) => !removed.has(dealer.id))
    .map((dealer) => {
      const patch = dealerOverrides.edits?.[dealer.id]
      return patch ? ({ ...dealer, ...patch } as T) : dealer
    })
  const additions = (dealerOverrides.additions ?? []).filter(
    (addition) => !removed.has(String(addition.id)) && !edited.some((d) => d.id === addition.id),
  ) as T[]
  return [...edited, ...additions]
}

/** Apply claim-status and pack-availability edits on top of the typed products. */
export function applyProductOverrides<
  T extends { id: string; claimsStatus: string; packs: Array<{ size: number; inStock: boolean }> },
>(base: T[]): T[] {
  return base.map((product) => {
    const claimsStatus = productOverrides.claimsStatus?.[product.id] ?? product.claimsStatus
    const packStock = productOverrides.packInStock?.[product.id]
    const packs = packStock
      ? product.packs.map((pack) =>
          Object.prototype.hasOwnProperty.call(packStock, String(pack.size))
            ? { ...pack, inStock: Boolean(packStock[String(pack.size)]) }
            : pack,
        )
      : product.packs
    return { ...product, claimsStatus, packs } as T
  })
}

/** Apply measured-LRV edits on top of the typed colours. */
export function applyColourOverrides<T extends { id: string; measuredLrv?: number }>(base: T[]): T[] {
  return base.map((colour) => {
    const measuredLrv = colourOverrides.measuredLrv?.[colour.id]
    return measuredLrv == null ? colour : ({ ...colour, measuredLrv } as T)
  })
}

/** Apply reviewer/updated edits on top of the typed guides. */
export function applyGuideOverrides<T extends { id: string; reviewer: string; updated: string }>(base: T[]): T[] {
  return base.map((guide) => {
    const patch = guideOverrides.edits?.[guide.id]
    return patch ? { ...guide, ...patch } : guide
  })
}
