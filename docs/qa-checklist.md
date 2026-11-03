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
| Room visualiser | Runs entirely in the browser on the visitor's own photo; the image never leaves the device. Upload, drag-and-drop or paste; magic fill with a tolerance, brush and eraser; undo; a before/after divider that opens showing the paint; matt and silk; a saved PNG. Where a browser has no canvas to draw on, the page says so and offers the library, the printed colour book and physical samples instead of a dead rectangle. Verified against every task in roadmap 12.02 — see `implementation-audit.md` §2. |
| Guides | Six articles with a named reviewer, review date and label-sourced technical content. |
| Enquiry pipeline | Real server, real validation, real reference numbers, real routing and SLA — the desk and the SLA are stored with the record, not only returned to the browser. |
| Newsletter consent | Sign-up *and* opt-out: `POST /api/unsubscribe` writes a timestamped suppression record, and re-subscribing is recorded as fresh consent with the opt-out retired beside it. |
| Technical documents | 12 generated PDFs (TD sheet and SDS per product) from one structured source. |
| Fan deck | 19-page printable colour deck generated from `colors.ts`, linked from the colour library. |
| Colour book | 32-page A5 brochure generated from `colors.ts`, `palettes.ts`, `projects.ts` and the product dictionary — see [brochure.md](brochure.md). |
| Room book | 20-page A5 scheme book: four methods, sixteen colourways rendered on the company's own site photographs. |
| Colour wheel | 3-page A4 quick-reference card: the full library as one wheel, the complete swatch grid, and a contact page. |
| Specification sheet | 2-page A4-landscape trade sheet: every product's finish, coverage and timing on one page, read from the product dictionary. |
| Enquiry inbox | `GET /admin` and `/admin/enquiries.csv` behind basic auth over a constant-time comparison, two roles (`viewer` reads, `exporter` downloads), a TOTP second factor per account, signed session cookies with a configurable TTL, an optional CIDR allowlist, and every decision — allowed, refused, challenged, signed out — written to `admin-access.jsonl`. 404 unless credentials are set, and 404 for an address outside the allowlist, so the inbox is invisible rather than merely locked. |
| Data-subject requests | `POST /api/privacy` takes the right being exercised (access, erasure, correction, objection, portability), returns a `DSAR-` reference and a 30-day `dueBy` on screen, announces it to the desk with the statutory deadline in the body, and stores it. The privacy notice carries the form and still names the email route beside it. Fulfilment is `tools/erase-record.mjs`: a dry run unless `--yes`, a suppression entry so the address cannot be resurrected, an audit line with references only, and no echo of the record it deleted. |
| Retention | Enforced, not promised: 30 days for operational logs, 24 months for enquiries and data-subject requests, subscriptions and suppression records kept for as long as they mean something. Runs at startup and daily, rewrites atomically, keeps a line whose date cannot be read, and logs what it dropped. The numbers are the ones the privacy notice publishes. |
| Notifications | Per-channel delivery with two retries, an audit line per attempt, a consecutive-failure counter, and `notify.channel_down` logged at three — so a webhook that died on Tuesday is not indistinguishable from a quiet week. The customer's own acknowledgement (reference, desk, response commitment, phone number, "estimate, not a quotation", the data-subject route) is sent after the response, in the background, and can never fail a submission. |
| Abuse limits | Twelve enquiries, six sign-ups, six opt-outs, twenty error reports, six second-factor attempts and three data-subject requests per address per ten minutes, counted in a file that survives a restart, with duplicate submissions inside ten minutes returning the first reference rather than a second record. A refusal always names the human route. |
| Monitoring | `tools/uptime-check.mjs`: six probes that each assert something about the response — the shell and title are real, every hashed bundle resolves, health says storage is ready and a channel is configured, the colour book is not truncated, the sitemap is there. `tools/smoke-production.mjs`: 21 checks including the release stamp, so a deploy that did not take is a failure rather than a shrug. `tools/load-test.mjs`: latency and error budgets under concurrency. Scheduled in CI, opening one issue on failure and closing it on recovery. |
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

261 automated checks run on every `npm run check` (92 unit and content-integrity,
112 server, 29 route render, 28 in a real DOM), plus the CI jobs that need a
browser binary.

- `npm run lint` — oxlint, zero errors. (Twelve warnings remain, all of them
  deliberate: `react/set-state-in-effect` on the store's hydration effect and
  `react/only-export-components` on two hooks exported beside their provider.)
- `npm test` — **92 tests**: 14 calculator, 13 covering the wall picker and the
  preview compositor, 35 content-integrity and 30 covering the advisor, the
  share-link codec and the tools data. The mask tests include the load timeout —
  the one failure mode a test cannot otherwise reach, because it is an image that
  fires neither `load` nor `error`. One of the
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
- `npm run test:server` — **112 tests across seven files**: the HTTP contract
  (validation, honeypot, routing and SLA, malformed JSON, 413 on an oversized
  body, subscriptions, colour search, inbox auth, CSV escaping, rate limiting),
  the abuse-limit store (durable counters, window expiry, ties broken by file
  order, a damaged line ignored rather than fatal, the per-process fallback and
  the log line that admits it), duplicate suppression (identical within the window,
  different in any one field, and a fingerprint that covers every field the visitor
  supplied), the inbox access model (roles, TOTP against RFC 4226 vectors and a
  ±1 step tolerance, session signing and expiry, tokens whose kind cannot be
  swapped, the allowlist across IPv4 and IPv6, each refusal's status code, and the
  access log's ten decisions), the data-subject intake (every right, the reference
  and the deadline, a note that is too long, the honeypot answering *identically*
  to the real form, the throttled response naming the human route, and the
  announcement carrying the statutory clock), retention (each file's own period,
  subscriptions and suppressions untouched, undated lines kept, a prune failure
  logged rather than silent), the Vercel proxy
  (`app/api/[...path].js`) against the real service, the operational paths
  (notification delivery and retry, a dead webhook not failing an enquiry,
  error-report scrubbing, health), and the deployment edges — CORS for an
  allowed origin and none for any other, rate limits that follow the visitor
  rather than the proxy, the generated colour index, an encoded path traversal
  against a sibling of the static root, CSV formula injection, measured
  quantities, and the newsletter opt-out round trip.
- `npm run test:browser` — **28 tests** in a jsdom DOM against a real enquiry
  service on a real socket: an invalid submission focuses the first bad field, a
  valid one stores exactly one record and shows its reference, a server-side
  field error lands on the right input without losing the typed answers, the
  honeypot stores nothing, the calculator's figures follow the inputs (including
  the imperial switch), the finish finder answers four questions with a real
  specification **and refuses to recommend anything for a damp wall**, a saved
  estimate becomes a checklist line and then a share link that opens the same
  project in a browser that has never seen it, the footer's opt-out reaches the
  service and writes a suppression record, the room preview opens with the paint
  visible rather than hidden behind its own divider, tells a browser with no
  canvas where to go instead, paints on a tap but not on a scroll, and selects a
  wall with no pointer at all — and headings descend in order on nine routes.
  Three of them drive the privacy notice's request form: a request reaches
  the service and is stored with its reference and deadline, a request with
  nowhere to answer it (no address) is stopped in the browser rather than sent,
  and the human route stays visible beside the form — a form is a path to a
  right, never a gate on one.
  jsdom has no canvas implementation, so the suite installs a recording stand-in
  for the visualiser; it exercises the real code path and asserts what the visitor
  is told, not what the pixels look like.
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
11. **The inbox, as each role** — sign in as a `viewer` and confirm the CSV
    export is refused (403) while the list opens; sign in as an `exporter` and
    download it; enter a wrong second factor and confirm the page says so without
    signing you in — and that a *replayed* code is named as replayed rather than
    quietly accepted; then read
    `admin-access.jsonl` and check every one of those attempts is a line in it.
12. **A data-subject request, end to end** — submit one from the privacy notice
    with a real address you control: the reference and the 30-day deadline appear
    on screen, the desk's channel receives it, the acknowledgement arrives, the
    record is in `privacy-requests.jsonl`, and `tools/erase-record.mjs --email
    <that address>` in a dry run lists exactly what would go.
13. **After a deploy** — `./tools/rollback.sh --snapshot` *before*, then
    `node tools/smoke-production.mjs --origin <origin> --release <stamp>` from
    outside the host network. Both are in `launch-runbook.md`.
14. **Your own wall, on a real phone** — `/room-preview`: upload a photograph,
    then drag one in and paste one; tap a wall and check the paint appears on the
    right of the divider; scroll the page *starting on the picture* and confirm it
    scrolls instead of painting; brush a doorframe out of the selection; undo;
    switch colour and finish; save the preview and open the PNG. Then repeat on a
    second-hand low-end Android — the 1400 px working frame and the reused
    offscreen canvases are what keep a stroke smooth there.

## Known gaps against the README roadmap

- No CMS. Content is edited in typed files and reviewed in Git (see
  `content-editing.md`) — and that is now a recorded decision with its cost and
  its exit condition, not an omission: [ADR 0002](adr/0002-typed-data-over-a-cms.md).
  A headless CMS remains the next operational step if a non-engineer has to
  publish alone.
- No accounts or dealer portal. The project board is per-browser local storage;
  a *durable share link* carries a project between devices, but it is the visitor
  who keeps it, not us.
- No inventory, payment, or order management. Every commercial journey ends in a
  quote, a dealer visit or a phone call, on purpose.
- No editor UI. `docs/deploying.md` covers running the service; content review is
  Git-based, and the inbox is read-only by design — there is no way to edit or
  delete a record from the browser, which is the correct default for personal
  data. Deletion is a logged shell tool (`tools/erase-record.mjs`) and pruning is
  automatic retention, so neither is a hand-edit of a JSON file any more.
- Analytics events are queued locally and consent-gated; no vendor is wired up
  and none should be added without the consent review described in the roadmap.
  Every event the roadmap's measurement plan names is now actually fired —
  `product_view`, `product_filter`, `guide_view`, `dealer_contact` and
  `quote_submit` were declared and called from nowhere.
- Newsletter sign-up is single opt-in. Double opt-in (a confirmation email before
  an address is mailed) is phase 14 and needs a sending domain.
- **Nothing is provisioned and nobody is on call.** The notification channel, the
  Sentry DSN, the dead-man's-switch account (`OPD_UPTIME_HEARTBEAT`), the staging
  host and the production host all need accounts and credentials this repository
  cannot create. The runbook has the table with the names left blank.
- **Alerts reach a channel, not a rota.** The uptime check can fail loudly and the
  workflow can open an issue, but who is told at 2am, and what they are authorised
  to do, is roadmap 17.02.12 and 20.01.01.
- **No penetration test and no legal review of the notices.** Both are gated on a
  budget and a lawyer (16.03.05, 17.02.13).
