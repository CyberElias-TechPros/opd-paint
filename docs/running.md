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
npm test             # 88 tests: 14 calculator + 9 colour-mask + 35 content
                     # integrity + 30 advisor / share-link / tools-data
npm run typecheck    # tsc -b — strict, exactOptionalPropertyTypes, and covering
                     # src/, vite.config.ts and the test scripts themselves
npm run test:server  # 61 tests against the real HTTP server, the Vercel proxy,
                     # the notification and error-intake paths, and the
                     # deployment edges (CORS, proxy-aware rate limiting, the
                     # colour index, path traversal, CSV injection, opt-out)
npm run test:routes  # 29 cases across 22 route modules render through the real
                     # router, each asserting an <h1>, clean markup and no price
                     # or stock claim in its structured data
npm run test:browser # 21 tests in a jsdom DOM against a real enquiry service on
                     # a real socket: the quote form, the calculator, the finish
                     # finder, the checklist-and-share-link round trip, and the
                     # newsletter opt-out
npm run test:a11y    # axe on 22 pages, keyboard, reduced motion, 360px
                     # — needs Chromium
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
prerender. The last step renders every route to a string *only to read its
metadata*, and writes `dist/<path>/index.html` — one file per URL — with that
page's title, description, canonical link, Open Graph tags and JSON-LD already
in the head. It also writes `dist/404.html`, the branded not-found document that
the server, nginx and Vercel all serve with a real 404 status: a catch-all
fallback to `index.html` would answer 200 and tell a crawler that every typo is
a page. Bodies are not prerendered: the app mounts with `createRoot`, which
would discard server markup anyway, and hydrating against local-storage state is
not worth the mismatch risk. The head is what link previews and non-JS crawlers
read, and 110 small files cost less than the app itself.

If you add a route, it belongs in five places, and four of them are tested:

1. `app/src/App.tsx` — the route itself (lazy, like the others).
2. `app/scripts/prerender.tsx` — so its head is written to `dist/<path>/index.html`.
   The script prints a route count and warns when a page renders no metadata.
3. `app/scripts/smoke.tsx` — so it is rendered on every run and its links are
   checked. Add any new path prefix to that file's `KNOWN` list, or every page
   linking to it fails the build.
4. `tools/build-sitemap.mjs` — unless the page is personal or transient.
   `/project` is deliberately absent: its content lives in the visitor's own
   storage and URL, so there is nothing to index.
5. `app/scripts/a11y.mjs` — so axe covers it in CI.

Change a colour and run `npm run index:colours` (the build does it for you): the
enquiry service searches a generated `server/colour-index.json`, and the content
tests fail if it drifts from `app/src/data/colors.ts`.

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
`server/data/subscriptions.jsonl`, opt-outs to
`server/data/unsubscriptions.jsonl`, error reports to `server/data/errors.jsonl`.
All are git-ignored: they are customer data and must never be committed. Back the
directory up on a schedule, and move to a real datastore before traffic makes a
single JSON file a bottleneck.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness probe: service name, version, uptime, storage state, damaged-record count, which notification channels exist, whether the inbox is enabled. Reports capability, never configuration. |
| `POST /api/quotes` | Enquiry submission. Validates every field, rate-limits, stores the routed desk and SLA with the record, returns a reference. |
| `POST /api/subscribe` | Newsletter sign-up. Records a re-subscription when the address had opted out. |
| `POST /api/unsubscribe` | Newsletter opt-out. Writes a timestamped suppression record; the address is never silently deleted. |
| `POST /api/errors` | Browser and server diagnostics. Scrubbed, rate-limited, always answers 202. |
| `GET /api/search/colours?q=` | Colour search over the generated index (`server/colour-index.json`). |
| `GET /admin`, `GET /admin/enquiries.csv` | The read-only enquiry inbox and its export. 404 unless credentials are set, 401 without them. |

Environment: `PORT` (default `8787`), `OPD_DATA_DIR`, `OPD_STATIC_DIR`,
`OPD_ADMIN_USER`/`OPD_ADMIN_PASSWORD`, `OPD_ALLOWED_ORIGIN` (the single origin
allowed to call the API from a browser, when the site and the service are not
same-origin), `OPD_TRUST_PROXY` (believe `X-Forwarded-For` — only behind a proxy
that overwrites it), `OPD_COLOUR_INDEX`. All are documented in `.env.example`.

Rate limit is 12 enquiries per visitor address per 10 minutes, 6 sign-ups and 6
opt-outs, 20 error reports; each endpoint has its own bucket, so a busy quoting
session cannot lock somebody out of the newsletter. The hidden `company` field is
a honeypot that returns a fake success and stores nothing. Behind a reverse proxy
or Docker networking, set `OPD_TRUST_PROXY` or every visitor shares the gateway's
address — and the twelfth enquiry in ten minutes locks out a city.

## Regenerating assets

```bash
python3 tools/build-media.py       # photographs -> WebP + manifest + film poster
python3 tools/build-documents.py   # technical and safety data sheets (PDF)
python3 tools/build-icons.py       # app icons from the brand mark geometry
python3 tools/build-og.py          # 1200x630 social sharing card
node tools/build-sitemap.mjs       # sitemap.xml from the data files
npm run index:colours              # server/colour-index.json from colors.ts
```

All six are idempotent and safe to re-run. `npm run build` runs the sitemap and
colour-index steps automatically, so neither can describe a colour that has been
deleted — and `scripts/data.test.ts` fails if the committed index disagrees with
the library.

Requirements: `python3` with Pillow (`pip install --break-system-packages
pillow`), and `ffmpeg` for the film poster (`imageio-ffmpeg` provides a static
build).
