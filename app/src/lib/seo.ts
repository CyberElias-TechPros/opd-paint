import { useEffect } from 'react'

/**
 * Per-route metadata. A single-page app has to own its <title>, description and
 * canonical link itself; structured data is injected as JSON-LD and removed on
 * unmount so pages cannot inherit stale schema.
 */

export type Meta = {
  title: string
  description: string
  /** absolute path, e.g. /colours/lilac-room */
  path: string
  image?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  noIndex?: boolean
}

export const SITE = 'OPUDA’S PAINT'
export const ORIGIN = 'https://opudapaint.com'

/**
 * The full <title>, without the trailing brand when the route already includes
 * it. The brand is spelled with a curly apostrophe but routes often type a
 * straight one, so the comparison strips apostrophes rather than betting on
 * which the author used.
 */
const hasBrand = (title: string) => title.replace(/['’]/g, '').includes(SITE.replace(/['’]/g, ''))

export const pageTitle = (title: string) => (hasBrand(title) ? title : `${title} — ${SITE}`)

/**
 * Server-side hand-off.
 *
 * Effects do not run when a route is rendered to a string, so a prerender would
 * otherwise lose every page's title and description. During such a render the
 * hook simply records what it was given; the prerender script reads it back and
 * writes the tags into the HTML it emits. In the browser nothing is recorded.
 */
let rendered: Meta | null = null

export function takeRenderedMeta(): Meta | null {
  const meta = rendered
  rendered = null
  return meta
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value))
}

export function usePageMeta({ title, description, path, image, jsonLd, noIndex }: Meta) {
  // Routes usually pass an inline object literal, which is a new reference on
  // every render. Serialising it keeps the effect from tearing down and
  // re-adding the JSON-LD script each time the page re-renders.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  if (typeof document === 'undefined') rendered = { title, description, path, image, jsonLd, noIndex }

  useEffect(() => {
    const fullTitle = pageTitle(title)
    document.title = fullTitle
    const desc = description.slice(0, 300)

    upsertMeta('meta[name="description"]', { name: 'description', content: desc })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: desc })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: `${ORIGIN}${path}` })
    if (image) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: `${ORIGIN}${image}` })
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noIndex ? 'noindex,nofollow' : 'index,follow' })

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = `${ORIGIN}${path}`

    const scripts: HTMLScriptElement[] = []
    if (jsonLdKey) {
      const parsed: unknown = JSON.parse(jsonLdKey)
      const blocks = Array.isArray(parsed) ? parsed : [parsed]
      blocks.forEach((block: unknown) => {
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.dataset.route = path
        script.textContent = JSON.stringify(block)
        document.head.appendChild(script)
        scripts.push(script)
      })
    }

    return () => {
      scripts.forEach((s) => s.remove())
    }
  }, [title, description, path, image, jsonLdKey, noIndex])
}

export const ORGANISATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'OPUDA’S PAINT',
  url: ORIGIN,
  slogan: 'Colour, made in Nigeria.',
  telephone: '+2349026424350',
  areaServed: 'NG',
  logo: `${ORIGIN}/brand/mark.svg`,
  description:
    'Nigerian paint manufacturer producing matt, silk, gloss and weather-resistant exterior coatings, with a five-year guarantee.',
}

export const localBusinessSchema = (dealer: { name: string; city: string; state: string; lat: number; lng: number; hours: string }) => ({
  '@context': 'https://schema.org',
  '@type': 'PaintStore',
  name: dealer.name,
  address: { '@type': 'PostalAddress', addressLocality: dealer.city, addressRegion: dealer.state, addressCountry: 'NG' },
  geo: { '@type': 'GeoCoordinates', latitude: dealer.lat, longitude: dealer.lng },
  telephone: '+2349026424350',
  openingHours: dealer.hours,
})
