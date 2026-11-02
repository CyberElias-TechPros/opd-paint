# QA checklist and honest status

This file exists so nobody mistakes the build for something it is not. The site
is real and works; some of the *data* behind it is deliberately marked as
provisional because the source of truth lives with the commercial and technical
teams, not in a repository.

## What is real

| Area | Status |
| --- | --- |
| Brand and product identity | From the company's own pails and banners: wordmark, house mark, MATT and SILK lines, printed label claims, 5-year guarantee, 0902 642 4350. |
| Photography | All 49 served images in the media manifest — 34 project photographs, 7 interiors, 4 product shots, 2 brand banners — derive from the 54 originals in `opuda/`. The two `render-modern-*` frames are architectural artwork and are labelled as concept renders, never as completed work. Nothing is stock or AI-generated. |
| Colour library | 59 colours with permanent codes, families, undertones, room suitability and editorial notes. Every hex is a digital proof, not a chip match. |
| Quantity engine | Formula documented on the page, verified by 14 unit tests against hand-worked examples — and an estimate can be saved to the project board, printed on a checklist and attached to an enquiry as a measured quantity. |
| Decision-support tools | Finish finder, surface-preparation advisor, project checklist and a durable share link: `/tools`, `/tools/finish-finder`, `/tools/surface-prep`, `/project`. The recommendation engine is an explicit rule table with 30 tests, not a black box, and every reason it gives is a sentence a person can read aloud. |
| Room visualiser | Runs entirely in the browser on the visitor's own photo; the image never leaves the device. |
| Guides | Six articles with a named reviewer, review date and label-sourced technical content. |
| Enquiry pipeline | Real server, real validation, real reference numbers, real routing and SLA — the desk and the SLA are stored with the record, not only returned to the browser. |
| Newsletter consent | Sign-up *and* opt-out: `POST /api/unsubscribe` writes a timestamped suppression record, and re-subscribing is recorded as fresh consent with the opt-out retired beside it. |
| Technical documents | 12 generated PDFs (TD sheet and SDS per product) from one structured source. |
| Fan deck | 19-page printable colour deck generated from `colors.ts`, linked from the colour library. |
| Colour book | 32-page A5 brochure generated from `colors.ts`, `palettes.ts`, `projects.ts` and the product dictionary — see [brochure.md](brochure.md). |
| Room book | 20-page A5 scheme book: four methods, sixteen colourways rendered on the company's own site photographs. |
| Colour wheel | 3-page A4 quick-reference card: the full library as one wheel, the complete swatch grid, and a contact page. |
| Specification sheet | 2-page A4-landscape trade sheet: every product's finish, coverage and timing on one page, read from the product dictionary. |
| Enquiry inbox | `GET /admin` and `/admin/enquiries.csv`, basic auth over a constant-time comparison, 404 unless credentials are set. |
| Offline | Service worker: network-first pages, cached photography and fonts, branded offline page, API never cached. |
| Printing | Print stylesheet keeps every swatch (`print-color-adjust: exact`) and drops the chrome. |

## What is explicitly provisional

- **Dealer network.** Representative trading areas, marked `verified: false`
  unless confirmed. Replace `dealers.ts` with the commercial export.
- **Prices.** Not published anywhere on the site. Every price-dependent surface
  (product pages, the calculator, colour pages) routes to WhatsApp, the quote
  form or a dealer instead of showing a figure.
- **Stock.** Never claimed. Unverified stock renders "ask dealer".
- **Primer, gloss, weathershield, screeding.** Standard lines for a manufacturer
  at this scale, flagged `pending-verification` until the technical owner signs
  the specs off.
- **Testimonials and completed-project client names.** Deliberately absent.
- **Domain.** `https://opudapaint.com` is used in the sitemap, canonical URL and
  PDF footers as the assumed production address. Confirm or regenerate with
  `node tools/build-sitemap.mjs https://real-domain`.

## Automated checks

```bash
cd app && npm run check
```

199 automated checks run on every `npm run check`, plus four CI jobs that need a
browser.

- `npm run lint` — oxlint, zero errors. (Twelve warnings remain, all of them
  deliberate: `react/set-state-in-effect` on the store's hydration effect and
  `react/only-export-components` on two hooks exported beside their provider.)
- `npm test` — **88 tests**: 14 calculator, 9 colour-mask, 35 content-integrity
  and 30 covering the advisor, the share-link codec and the tools data. One of the
  content tests is a contrast guard: it reads the accent tokens out of
  `theme.css`, composites them over the dark panel they are used on and fails
  below 4.5:1 — the browser-free version of the check axe runs in CI, added after
  axe found three real failures on a new page.
  Content tests check unique ids and codes, valid hex, palette/guide/project
  cross-references, media manifest coverage, alt text, PDF existence, dealer
  coordinates, no render labelled as completed work, no unused image — and that
  `server/colour-index.json`, which the enquiry service searches at runtime,
  still matches the library it was generated from.
  Advisor tests check that every one of the 336 answer combinations recommends a
  real product with that product's own coat count, that a damp wall is refused
  rather than sold to, that bare timber and steel are told this range has no
  primer for them, that every preparation situation cites products and guides
  that exist, that every checklist link points at a route this app owns, and that
  a shared link survives a round trip — while a tampered, truncated or empty
  token is rejected instead of half-rendered.
- `tsc -b` — full type check with `strict`, `verbatimModuleSyntax` and
  `exactOptionalPropertyTypes` on, covering `src/`, `vite.config.ts` **and the
  test scripts themselves** (`tsconfig.scripts.json`). The scripts were the only
  TypeScript nothing checked, which is how a suite comes to assert against a
  signature that no longer exists.
- `npm run test:routes` — **29 cases across 22 route modules**, rendered through
  the real router, each asserting an `<h1>`, no `undefined`/`NaN`/`[object
  Object]` in the markup, no link to a route the app does not own, and **no
  price, offer or availability claim in its structured data** — the site
  publishes no prices and holds no stock, and search engines print JSON-LD
  figures directly into rich results.
- `npm run test:server` — **61 tests**: the HTTP contract (validation, honeypot,
  routing and SLA, malformed JSON, 413 on an oversized body, subscriptions,
  colour search, inbox auth, CSV escaping, rate limiting), the Vercel proxy
  (`app/api/[...path].js`) against the real service, the operational paths
  (notification delivery and retry, a dead webhook not failing an enquiry,
  error-report scrubbing, health), and the deployment edges — CORS for an
  allowed origin and none for any other, rate limits that follow the visitor
  rather than the proxy, the generated colour index, an encoded path traversal
  against a sibling of the static root, CSV formula injection, measured
  quantities, and the newsletter opt-out round trip.
- `npm run test:browser` — **21 tests** in a jsdom DOM against a real enquiry
  service on a real socket: an invalid submission focuses the first bad field, a
  valid one stores exactly one record and shows its reference, a server-side
  field error lands on the right input without losing the typed answers, the
  honeypot stores nothing, the calculator's figures follow the inputs (including
  the imperial switch), the finish finder answers four questions with a real
  specification **and refuses to recommend anything for a damp wall**, a saved
  estimate becomes a checklist line and then a share link that opens the same
  project in a browser that has never seen it, the footer's opt-out reaches the
  service and writes a suppression record, and headings descend in order on nine
  routes.
- `bash tools/verify-restore.sh` — the real backup and restore scripts, end to
  end, including a damaged archive and a traversal attempt.

CI adds four jobs that need a browser binary or network access, so they run
there rather than as part of `npm run check`. All four are green:

- **Accessibility** — axe-core (WCAG 2.2 A/AA) on twenty-two pages in Chromium,
  plus the things a rule cannot check: the skip link is the first Tab stop,
  focus is visible on every interactive element, reduced motion really is
  reduced, no page overflows a 360 px screen, and no console errors.
- **Lighthouse budgets** — accessibility 100, best practices ≥ 95, SEO ≥ 95,
  LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 300 ms, with script/CSS/image/font weight caps.
- **Dependencies and secrets** — `npm audit` (blocking for production
  dependencies at high/critical), plus `tools/scan-secrets.mjs` over the working
  tree and every line of history, plus gitleaks on top when its binary can be
  fetched.
- Production build with route-level code splitting, then a head prerender that
  writes one `dist/<path>/index.html` per URL with its own title, description,
  canonical, Open Graph tags and JSON-LD.
- CI regenerates the icons, documents, fan deck, all four books and cards, the master
  catalogue, social card and sitemap and fails if the committed artefacts differ from
  their scripts.

## Manual pass before any release

The automated checks above cover the contract, the DOM and the accessibility
rules. What they cannot cover is how it feels on a real phone on a real network,
so this part is human.

1. **Keyboard only** — Tab from the top of every page: skip link, header, then
   page content. Focus must always be visible and in a sensible order.
2. **The six journeys** — colour → preview → save → quote; product → specs →
   calculator → **save estimate → project checklist → share link** → quote;
   **tools → finish finder → recommended system → surface prep**; dealer search
   with location denied *and* allowed; guide → related product → quote;
   404 → recovery link.
3. **Forms** — submit each empty, then with a bad phone number. The first
   invalid field must take focus and the error must be read by a screen reader.
4. **Narrow screen (360 px)** — no horizontal scroll, header menu usable, sticky
   bars not covering the submit button on the quote form.
5. **Zoom to 200%** — text must not clip or overlap.
6. **Reduced motion** — with the OS setting on, no parallax, marquee or reveal
   animation runs, and content is fully visible.
7. **Offline API** — stop `npm run server`, submit an enquiry: the failure must
   keep the visitor's answers and offer the phone number.
8. **Print** — the colour detail page, the calculator and the project checklist
   printed to PDF: no navigation chrome, figures legible in black and white.
9. **Share a project** — copy the link on one device or browser profile, open it
   in another: the name, colours, products and quantities arrive, and a
   hand-edited token is refused with a sentence rather than a broken page.
10. **Opt out** — switch the footer form to "remove an address", submit an
    address that is on the list, and confirm no further mail would be sent. The
    suppression record is in `server/data/unsubscriptions.jsonl`.

## Known gaps against the README roadmap

- No CMS. Content is edited in typed files and reviewed in Git (see
  `content-editing.md`). A headless CMS is the next operational step.
- No accounts or dealer portal. The project board is per-browser local storage;
  a *durable share link* carries a project between devices, but it is the visitor
  who keeps it, not us.
- No inventory, payment, or order management. Every commercial journey ends in a
  quote, a dealer visit or a phone call, on purpose.
- No editor UI. `docs/deploying.md` covers running the service; content review is
  Git-based, and the inbox is read-only by design — there is no way to edit or
  delete a record from the browser, which is the correct default for personal
  data but means pruning is a shell job.
- Analytics events are queued locally and consent-gated; no vendor is wired up
  and none should be added without the consent review described in the roadmap.
  Every event the roadmap's measurement plan names is now actually fired —
  `product_view`, `product_filter`, `guide_view`, `dealer_contact` and
  `quote_submit` were declared and called from nowhere.
- Newsletter sign-up is single opt-in. Double opt-in (a confirmation email before
  an address is mailed) is phase 14 and needs a sending domain.
