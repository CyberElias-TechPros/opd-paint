# Running the platform

Two processes: the site (Vite) and the enquiry API (plain Node). The site calls
the API on **relative** URLs (`/api/...`) and Vite proxies them, so there is no
API URL to configure and no cross-origin request in the browser.

```bash
cd app
npm install
```

## Development

```bash
# terminal 1 — enquiry API on :8787
npm run server

# terminal 2 — site on :5173, /api proxied to :8787
npm run dev
```

The dev server binds `0.0.0.0` and accepts any host name, because it is usually
reached through a preview proxy whose hostname rotates. That setting applies to
`vite dev` only.

If the API is not running, the site still works. Only the enquiry form and the
server-side colour search need it; a failed submission keeps the visitor's
answers in local storage and tells them to call instead of losing the enquiry.

## Checks

```bash
npm run lint         # oxlint, zero errors expected
npm test             # 14 calculator + 9 colour-mask + 32 content-integrity tests
npm run typecheck    # tsc -b
npm run test:server  # 39 tests against the real HTTP server, the Vercel proxy
                     # and the notification / error-intake paths
npm run test:routes  # every route renders
npm run test:browser # 7 tests: the quote form and calculator in a jsdom DOM,
                     # submitting to a real enquiry service on a real socket
npm run test:a11y    # axe, keyboard, reduced motion, 360px — needs Chromium
npm run check        # lint, all of the above except a11y, and a production build
```

`npm run test:a11y` needs a browser binary (`npx playwright install chromium`)
and a served build; it is a CI job rather than part of `npm run check` so a
laptop without Chromium is not blocked. With no browser it exits 2 and says
what to install — it does not pretend to have passed.

Backups have their own check:

```bash
bash tools/verify-restore.sh   # runs the real backup.sh and restore.sh
```

## What the build produces

`npm run build` runs the sitemap generator, `tsc -b`, `vite build`, then a head
prerender. The last step renders all 92 routes to a string *only to read their
metadata*, and writes `dist/<path>/index.html` — one file per URL — with that
page's title, description, canonical link, Open Graph tags and JSON-LD already
in the head. It also writes `dist/404.html`, the branded not-found document that
the server, nginx and Vercel all serve with a real 404 status: a catch-all
fallback to `index.html` would answer 200 and tell a crawler that every typo is
a page. Bodies are not prerendered: the app mounts with `createRoot`, which
would discard server markup anyway, and hydrating against local-storage state is
not worth the mismatch risk. The head is what link previews and non-JS crawlers
read, and 92 small files cost less than the app itself.

If you add a route, add it to `app/scripts/prerender.tsx`; the script prints a
route count and warns when a page renders no metadata.

`npm test` runs the TypeScript sources directly under Node's type stripping via
`scripts/register.mjs`, which teaches Node the two bundler behaviours the app
relies on (extensionless imports, JSON without an import attribute).

## Production build

```bash
npm run build      # regenerates sitemap.xml, type-checks, builds to app/dist
npm run preview    # serve app/dist on :4173 to check the real bundle
```

`app/dist` is a static folder. Serve it behind any web server that rewrites
unknown paths to `index.html` (the router is client-side), for example:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
location /api/ {
  proxy_pass http://127.0.0.1:8787;
}
```

Long-cache `/assets/*` (they are content-hashed) and serve `/media/*` with a
shorter cache, since photographs are replaced by re-running the media pipeline.

## The enquiry API

`server/index.mjs` uses only Node's `http` module — no dependencies, no
database. Enquiries append to `server/data/quotes.jsonl`, subscriptions to
`server/data/subscriptions.jsonl`. Both are git-ignored: they are customer data
and must never be committed. Back the directory up on a schedule, and move to a
real datastore before traffic makes a single JSON file a bottleneck.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness probe: service name, uptime, time. |
| `POST /api/quotes` | Enquiry submission. Validates, rate-limits, returns a reference and the desk it was routed to. |
| `POST /api/subscribe` | Guide / newsletter sign-up. |
| `GET /api/search/colours?q=` | Colour search over the library. |

Environment: `PORT` (default `8787`), `OPD_ALLOWED_ORIGIN` if the site is ever
served from a different origin than the API.

Rate limit is 12 submissions per IP per 10 minutes; the hidden `company` field
is a honeypot that returns a fake success and stores nothing.

## Regenerating assets

```bash
python3 tools/build-media.py       # photographs -> WebP + manifest + film poster
python3 tools/build-documents.py   # technical and safety data sheets (PDF)
python3 tools/build-icons.py       # app icons from the brand mark geometry
python3 tools/build-og.py          # 1200x630 social sharing card
node tools/build-sitemap.mjs       # sitemap.xml from the data files
```

All five are idempotent and safe to re-run. `npm run build` runs the sitemap
step automatically so it can never describe a colour that has been deleted.

Requirements: `python3` with Pillow (`pip install --break-system-packages
pillow`), and `ffmpeg` for the film poster (`imageio-ffmpeg` provides a static
build).
