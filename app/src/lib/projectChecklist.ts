import type { Finish, Product } from '../data/products'

/**
 * The order a decorator actually works in: prep/filler, then primer, then a
 * specialist exterior basecoat, then the topcoats, trim last. This mirrors
 * the sequence already described per-product in each product's own
 * `application` steps (see `data/products.ts`) — it does not invent a new
 * one, it just orders several saved products against each other.
 */
const FINISH_ORDER: Record<Finish, number> = {
  Filler: 0,
  Primer: 1,
  Texture: 2,
  Satin: 3,
  Matt: 3,
  Silk: 3,
  Gloss: 4,
}

export function orderProductsForWork(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const order = FINISH_ORDER[a.finish] - FINISH_ORDER[b.finish]
    return order !== 0 ? order : a.name.localeCompare(b.name)
  })
}
