/*
 * OPUDA'S PAINT — service worker.
 *
 * Goals, in order: never serve a stale page, never lose a page you already
 * loaded, and never cache anything personal.
 *
 *  · Navigations: network first, falling back to the cached shell, then to a
 *    branded offline page. A deploy therefore reaches a visitor immediately.
 *  · Photography, fonts, PDFs: stale-while-revalidate. They are content-hashed
 *    or replaced wholesale by the asset scripts, so one stale paint is harmless
 *    while the fresh copy downloads for next time.
 *  · API requests are never cached: an enquiry is a POST and a health check is
 *    meaningless from a cache.
 *
 * Bump CACHE_VERSION when the offline page or the shell changes.
 */

const CACHE_VERSION = 'opudas-v1'
const SHELL = ['/', '/offline.html', '/brand/mark.svg', '/site.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION)
      // A missing optional file must not fail the whole install.
      await Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

const isAsset = (url) =>
  /\/(assets|media|documents)\//.test(url.pathname) ||
  /\.(webp|jpg|jpeg|png|svg|woff2|pdf|mp4)$/i.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(CACHE_VERSION)
          cache.put('/', response.clone())
          return response
        } catch {
          const cache = await caches.open(CACHE_VERSION)
          return (await cache.match('/')) || (await cache.match('/offline.html')) || Response.error()
        }
      })(),
    )
    return
  }

  if (!isAsset(url)) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION)
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => null)

      // Serve what we have immediately, refresh in the background.
      return cached || (await network) || Response.error()
    })(),
  )
})
