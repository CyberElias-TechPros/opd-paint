# QA checklist and honest status

This file exists so nobody mistakes the build for something it is not. The site
is real and works; some of the *data* behind it is deliberately marked as
provisional because the source of truth lives with the commercial and technical
teams, not in a repository.

## What is real

| Area | Status |
| --- | --- |
| Brand and product identity | From the company's own pails and banners: wordmark, house mark, MATT and SILK lines, printed label claims, 5-year guarantee, 0902 642 4350. |
| Photography | All 22 images derive from the supplied originals in `opuda/`. Nothing is stock or AI-generated. |
| Colour library | 59 colours with permanent codes, families, undertones, room suitability and editorial notes. Every hex is a digital proof, not a chip match. |
| Quantity engine | Formula documented on the page, verified by 14 unit tests against hand-worked examples. |
| Room visualiser | Runs entirely in the browser on the visitor's own photo; the image never leaves the device. |
| Guides | Six articles with a named reviewer, review date and label-sourced technical content. |
| Enquiry pipeline | Real server, real validation, real reference numbers, real routing and SLA. |
| Technical documents | 12 generated PDFs (TD sheet and SDS per product) from one structured source. |
| Fan deck | 19-page printable colour deck generated from `colors.ts`, linked from the colour library. |
| Colour book | 32-page A5 brochure generated from `colors.ts`, `palettes.ts`, `projects.ts` and the product dictionary — see [brochure.md](brochure.md). |
| Enquiry inbox | `GET /admin` and `/admin/enquiries.csv`, basic auth over a constant-time comparison, 404 unless credentials are set. |
| Offline | Service worker: network-first pages, cached photography and fonts, branded offline page, API never cached. |
| Printing | Print stylesheet keeps every swatch (`print-color-adjust: exact`) and drops the chrome. |

## What is explicitly provisional

- **Dealer network.** Representative trading areas, marked `verified: false`
  unless confirmed. Replace `dealers.ts` with the commercial export.
- **Prices.** Guide prices, marked as such in every surface, excluding VAT and
  delivery. Not wired to a price list or inventory.
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

- `npm run lint` — oxlint, zero errors.
- `npm test` — 14 calculator, 9 colour-mask and 32 content-integrity tests, plus
  19 HTTP-level tests against the real enquiry service (validation, honeypot,
  routing and SLA, malformed JSON, 413 on an oversized body, subscriptions,
  colour search, inbox auth, CSV escaping, rate limiting). Content tests check
  unique ids and
  codes, valid hex, palette/guide/project cross-references, media manifest
  coverage, alt text, PDF existence, dealer coordinates, no render labelled as
  completed work, no unused image.
- `tsc -b` — full type check, `verbatimModuleSyntax` and
  `exactOptionalPropertyTypes` on.
- `npm run test:routes` — all 21 routes rendered through the real router, each
  asserting an `<h1>`, no `undefined`/`NaN`/`[object Object]` in the markup, and
  no link to a route the app does not own.
- `npm run test:server` — 39 tests: the HTTP contract above, the Vercel proxy
  (`app/api/[...path].js`) against the real service, and the operational paths —
  notification delivery and retry, a dead webhook not failing an enquiry,
  error-report scrubbing, and the health check.
- `npm run test:browser` — 7 tests in a jsdom DOM against a real enquiry service
  on a real socket: an invalid submission focuses the first bad field, a valid
  one stores exactly one record and shows its reference, a server-side field
  error lands on the right input without losing the typed answers, the honeypot
  stores nothing, and the calculator's figures follow the inputs (including the
  imperial switch).
- `bash tools/verify-restore.sh` — the real backup and restore scripts, end to
  end, including a damaged archive and a traversal attempt.

CI adds four jobs that need a browser binary or network access, so they run
there rather than as part of `npm run check`. All four are green:

- **Accessibility** — axe-core (WCAG 2.2 A/AA) on thirteen pages in Chromium,
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
- CI regenerates the icons, documents, fan deck, colour book, social card and sitemap and
  fails if the committed artefacts differ from their scripts.

## Manual pass before any release

The automated checks above cover the contract, the DOM and the accessibility
rules. What they cannot cover is how it feels on a real phone on a real network,
so this part is human.

1. **Keyboard only** — Tab from the top of every page: skip link, header, then
   page content. Focus must always be visible and in a sensible order.
2. **The five journeys** — colour → preview → save → quote; product → specs →
   calculator → quote; dealer search with location denied *and* allowed;
   guide → related product → quote; 404 → recovery link.
3. **Forms** — submit each empty, then with a bad phone number. The first
   invalid field must take focus and the error must be read by a screen reader.
4. **Narrow screen (360 px)** — no horizontal scroll, header menu usable, sticky
   bars not covering the submit button on the quote form.
5. **Zoom to 200%** — text must not clip or overlap.
6. **Reduced motion** — with the OS setting on, no parallax, marquee or reveal
   animation runs, and content is fully visible.
7. **Offline API** — stop `npm run server`, submit an enquiry: the failure must
   keep the visitor's answers and offer the phone number.
8. **Print** — the colour detail page and the calculator printed to PDF: no
   navigation chrome, figures legible in black and white.

## Known gaps against the README roadmap

- No CMS. Content is edited in typed files and reviewed in Git (see
  `content-editing.md`). A headless CMS is the next operational step.
- No accounts, saved projects across devices, or dealer portal — the project
  board is per-browser local storage.
- No inventory, payment, or order management. Every commercial journey ends in a
  quote, a dealer visit or a phone call, on purpose.
- No editor UI. `docs/deploying.md` covers running the service; content review is
  Git-based, and the inbox is read-only by design — there is no way to edit or
  delete a record from the browser, which is the correct default for personal
  data but means pruning is a shell job.
- Analytics events are queued locally and consent-gated; no vendor is wired up
  and none should be added without the consent review described in the roadmap.
