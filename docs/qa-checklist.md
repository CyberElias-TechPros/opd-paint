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
- `npm test` — 14 calculator tests, 32 content-integrity tests: unique ids and
  codes, valid hex, palette/guide/project cross-references, media manifest
  coverage, alt text, PDF existence, dealer coordinates, no render labelled as
  completed work, no unused image.
- `tsc -b` — full type check, `verbatimModuleSyntax` and
  `exactOptionalPropertyTypes` on.
- Production build with route-level code splitting.

## Manual pass before any release

There is no headless browser in the build environment, so this part is human.

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
- Analytics events are queued locally and consent-gated; no vendor is wired up
  and none should be added without the consent review described in the roadmap.
