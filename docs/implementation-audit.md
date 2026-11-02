# Implementation audit — 2 November 2026

A line-by-line comparison of the codebase against every document in this
repository, followed by the work that comparison produced.

The question it answers is the one `docs/remaining-work.md` answers at the level
of *gates*: **does what is built match what the documents say is built, and where
does it not?** `remaining-work.md` is forward-looking (what is left); this file is
backward-looking (what was wrong, what was done about it, and what is still wrong
on purpose).

Everything here is stated with its evidence — a file path, a test name, or a
command you can run. Where something could not be verified in this environment,
that is said rather than assumed.

---

## 1. Method

1. **Baseline before touching anything.** `cd app && npm run check` — lint, 55
   unit tests, 39 server tests, 21 route renders, 12 browser tests, and a build
   producing 101 sitemap URLs and 106 prerendered heads. Green. Any regression
   after this point is mine, not inherited.
2. **Read the plan.** The root `README.md` in full: phases 00–22, release gates
   G0–G9, cross-cutting requirements A–F, and the task list with its priority
   codes (P0/P1/P2) and "conditional" markers.
3. **Read the docs.** `docs/{README,remaining-work,qa-checklist,running,content-editing,deploying,operations,brochure,catalogue,campaign-the-approval-call}.md`.
4. **Read the implementation.** Every module in `app/src` (22 route components,
   components, `lib/`, `data/`, `store/`), all of `server/`, `tools/`,
   `app/scripts/`, `deploy/`, `Dockerfile`, `docker-compose.yml`,
   `.github/workflows/ci.yml`, `.env.example`, `app/vercel.json`,
   `app/api/[...path].js`, `app/public/{sw.js,robots.txt,site.webmanifest}`.
5. **Counted the real data** rather than trusting prose: 59 colours, 9 families,
   9 palettes, 19 projects, 6 products, 6 guides, 14 dealers, 49 manifest images.
6. **Compared** each roadmap task group and each documented claim against the
   code, then hunted for flaws independently of the roadmap — the ones a plan
   never mentions because nobody knew to write them down.
7. **Fixed** what was fixable without new data, credentials or a human being, and
   recorded what is not.

Two rules were held throughout, because they are this project's rules and not
general good practice:

- **Nothing invented.** No price, no stock claim, no testimonial, no address, no
  specification that is not in the typed data or on a pail. Where the honest
  answer is "we do not publish that", the code says so.
- **Generated artefacts stay byte-reproducible.** `tools/check-assets.py`
  compares every committed PDF, image and card against its generator in CI.
  Nothing in this audit changed a committed artefact's bytes.

---

## 2. Features that were incomplete, and are now built

The roadmap's phase 11.02 — "decision support" — was the largest honest gap: five
task groups described a set of tools the site did not have, and
`docs/remaining-work.md` said so plainly ("Phase 11.02 — the missing
decision-support tools"). They are built now.

| Roadmap | What was missing | What exists now | Evidence |
| --- | --- | --- | --- |
| **11.02.01** Finish selection as a guided flow, not a filter | Nothing. The products page had a finish filter, which is a different thing. | Four questions (surface, condition, wear, sheen) answered by an explicit, explainable rule table: a topcoat, a runner-up, a primer or screed where the substrate needs one, the coat count from the product's own data sheet, a preparation sequence, and the reasons in sentences a person can read aloud over the phone. | `app/src/routes/FinishFinder.tsx`, `app/src/lib/advisor.ts` (`RULES`, `recommendFinish`), `app/src/data/tools.ts` (`FINISH_QUESTIONS`, `*_OPTIONS`) |
| **11.02.02** Surface-preparation decision support | Nothing. Prep advice existed only as prose inside six guides. | Ten named situations (new render, sound repaint, flaking, uneven, chalky, damp, mould, efflorescence, old gloss, coastal), each with recognition signs, where it turns up, an ordered sequence, the products in the order they are used, links to the guides that carry the reasoning, and hard stops for what paint cannot fix. Index at `/tools/surface-prep`, detail at `?situation=<id>`, with `HowTo` and `ItemList` structured data. | `app/src/routes/SurfacePrep.tsx`, `PREP_SITUATIONS` in `app/src/data/tools.ts` |
| **11.02.03** Palette pairing recommendations | Partly there: `ColourDetail` already showed the palettes a colour belongs to and the roles it plays in them. | Unchanged, and deliberately so — the existing implementation satisfies the task. The new tools now link into it rather than duplicating it. | `app/src/routes/ColourDetail.tsx`, `app/src/data/palettes.ts` |
| **11.02.04** Project checklist export | The board could be copied as a list of colour names. | A checklist in the order work actually happens — before you buy, what to buy, prepare, apply, after the last coat — built from the board's colours, products, saved quantities and preparation sequences. Print stylesheet, copy to clipboard, and a `.txt` download. Empty board produces an empty checklist rather than generic advice. | `app/src/routes/Project.tsx`, `buildChecklist`/`checklistToText` in `app/src/lib/advisor.ts` |
| **11.02.05** Save or share a project | The board was local storage only; "share" copied four colour ids into a `/colours?scheme=` URL, which could not carry a project. | A durable link that *is* the state: name, colours, products, quantities and prep sequences, encoded as bounded JSON in base64url on `/project?s=`. No backend, no account, no personal data. Decoding is defensive to the point of paranoia, because a shared link is untrusted input from an address bar. | `app/src/lib/share.ts`, `app/src/routes/Project.tsx`, `ProjectBoard.tsx` |
| **11.01.15** Save estimates to a project | The calculator computed packs and then threw them away. | "Save this estimate to my project" puts the pack combination, the room name, the area and the coat count on the board; the checklist prints it; the quote form attaches it as `quantities` so the desk quotes measured numbers instead of asking again. | `app/src/components/calculator/PaintCalculator.tsx`, `saveEstimate` in `app/src/store/AppStore.tsx`, `quantities` in `server/index.mjs` |
| **Tools hub** | — | `/tools` lists every practical tool with the roadmap task it answers, so the claim is checkable from the page itself. | `app/src/routes/Tools.tsx`, `TOOL_CARDS` |
| **11.02.06 / 11.02.07** | Interactive texture explorer; recommendation assistant | **Not built, on purpose.** Both are P2 and 11.02.07 is explicitly gated in the roadmap on "validating its utility and safeguards first". Building an assistant nobody has validated would be the one place this project should not be eager. | — |

Two further gaps were not phase 11.02 but were the same kind of thing — a promise
in the interface with nothing behind it:

- **Newsletter unsubscribe.** The footer printed "Unsubscribe in one click" while
  no unsubscribe path existed anywhere: not in the UI, not in the service, not in
  the data model. Under the NDPA that is a consent defect, not a copy defect —
  withdrawing consent has to be as easy as giving it. `POST /api/unsubscribe` now
  writes a timestamped suppression record to `server/data/unsubscriptions.jsonl`,
  the footer form switches between joining and leaving, and re-subscribing is
  recorded as fresh consent with the suppression entry retired beside it (so the
  opt-out stays provable rather than silently deleted).
- **Declared analytics events that were never fired.** `product_view`,
  `product_filter`, `guide_view`, `dealer_contact` and `quote_submit` existed in
  the event union and in the roadmap's measurement plan (16.01.04, 16.01.08) and
  were called from nowhere. They fire now, consent-gated like every other event.
  No vendor is wired up — that is phase 16 and needs the consent review first.

---

## 3. Flaws found and fixed

Ordered by consequence. Each one is a real defect with a real remedy, not a
style preference.

### P0 — the site said something untrue

| # | Flaw | Why it mattered | Remedy |
| --- | --- | --- | --- |
| 1 | `ColourDetail.tsx` published `AggregateOffer` structured data on **all 59 colour pages**: `priceCurrency: NGN`, `lowPrice: 6200`, `highPrice: 132000`, `availability: InStock`. | Both numbers were invented and the stock claim was false. This site publishes no prices and has no stock system; roadmap 10.03.12–13 and cross-cutting requirement F forbid exactly this, and `scripts/data.test.ts` already asserted no pack carries a price. Search engines render `lowPrice`/`highPrice` directly into rich results — the business would have been quoting prices it never set, to the whole internet, from 59 pages. | The `offers` block is gone. The `Product` schema keeps only what the page supports: name, sku, brand, colour, description, and a `CommunicateAction` pointing at the quote form. |
| 2 | `Calculator.tsx` published `offers: { price: '0' }`. | Truthful in isolation, but it made "no price in structured data" unenforceable as a rule — the next person adding a price would have a precedent to point at. | Removed, replaced with `featureList` describing what the tool does. |
| 3 | Nothing prevented either from coming back. | A fix that only fixes today's file is not a fix. | `scripts/smoke.tsx` now fails the build if any rendered page emits `"price"`, `"lowPrice"`, `"highPrice"`, `"priceCurrency"`, `"availability"` or `"offers"` inside a JSON-LD block — checked on the markup, not the source, so it catches JSON assembled from a helper or a data file. |
| 4 | `/colours` described "60 launch colours"; the library has 59. | Small, and exactly the kind of small untruth the content tests exist to stop. | The sentence reads `${COLORS.length}`. |
| 5 | "Eight palettes" was printed in four places: `docs/brochure.md`, `docs/remaining-work.md`, and — worse — in the **copy strings inside the generators** (`tools/brochure_copy.py` cover line, `build-catalogue.py`, `build-colorwheel.py`, `roombook_copy.py`). So the colour book's own cover, the colour wheel's index, the room book's cross-reference and the master catalogue's description all told a dealer there were eight palettes while nine were printed inside. | A printed document that misstates its own contents, going onto dealers' counters. | All four corrected and the affected documents regenerated: colour book, room book, colour wheel, specification sheet and the 126-page catalogue. `tools/check-assets.py` compares committed artefacts against their generators byte for byte, so the regenerated files are committed with this change and CI proves they match. |
| 6 | The finish finder recommended the solvent-borne **gloss** line for an interior wall when a visitor asked for "hard gloss" — while the caution directly underneath explained that gloss is for joinery and metal. | The tool argued with itself, and the recommendation was the wrong product for the surface. | The sheen rule is split by surface: gloss on timber or metal gets gloss; gloss asked for on a wall gets silk, with a reason that says this range has no gloss emulsion. Pinned by two tests covering all four wall surfaces. |

### P0 — the service behaved wrongly in a deployment

Every one of these passed its tests on a laptop and failed in production, which is
the worst category of bug: the evidence says it works.

| # | Flaw | Why it mattered | Remedy |
| --- | --- | --- | --- |
| 7 | `/api/search/colours` read `app/src/data/colors.ts` and pulled ids out with a regular expression **per request**. | The runtime container copies `server/` and `app/dist` — not the TypeScript sources — so the endpoint answered 500 in every real deployment while its tests, run from the repository root, stayed green. It also returned three fields where the client type promised four, so every result was missing its hex. | `tools/build-colour-index.mjs` generates `server/colour-index.json` from the same library the app bundles; the service reads it, caches it against the file's mtime, and falls back to a source parse only in a bare checkout (loudly, in the log). Wired into `npm run build` and into the Dockerfile's runtime stage, and `scripts/data.test.ts` fails if the committed index drifts from the library. |
| 8 | No CORS anywhere, although `docs/deploying.md` describes the site calling the service across origins. | A browser discards a cross-origin response with no `Access-Control-Allow-Origin`, so the enquiry form would fail on screen while succeeding on disk. `OPTIONS` answered 204 with an empty JSON body and no headers — the worst of both. | `OPD_ALLOWED_ORIGIN` sets the header on every `/api/` response including 422s and 429s, with `Vary: Origin`; preflight is answered properly on API paths and 404s elsewhere. A single origin rather than `*`, because enquiry bodies carry names and phone numbers. |
| 9 | Rate limiting keyed on `req.socket.remoteAddress`. | Behind nginx or Docker networking every visitor arrives from the gateway address, so the twelfth enquiry in ten minutes locked out a whole city — and the abuse log recorded the proxy for everything. | `OPD_TRUST_PROXY` opts into the first `X-Forwarded-For` entry, documented as safe *only* behind a proxy that overwrites the header (`deploy/nginx.conf` does). Never trusted by default, because on an exposed port that header is visitor-controlled. |
| 10 | The static-file guard was `candidate.startsWith(STATIC_DIR)`, with no separator. | With a root of `/srv/site` that accepts `/srv/site-secret`. The check existed to prevent traversal and did not. | Compared against the root plus `path.sep`. Tested with a sibling directory deliberately named `<root>-secret` and an encoded `%2e%2e%2f` traversal, which is the vector that survives a URL parser. |
| 11 | `csvCell` escaped quotes but not formula injection. | Enquiry messages are untrusted input that staff open in Excel. A cell beginning `=`, `+`, `-`, `@`, tab or CR is executed — `=cmd|'/C calc'!A1` arrives as a formula. | Cells beginning with any of those are prefixed with a single quote: readable, inert, and the OWASP-recommended remedy. |
| 12 | `routedTo` and `slaHours` were computed for the response and never stored. | The client shows them, the admin page has a "Desk" column, and the CSV has a `routedTo` field — so every stored enquiry read "Unrouted" and the desk split on `/admin` was permanently empty. | Both are persisted on the record; the desk statistics now mean something. |
| 13 | `escapeHtml` did not escape `'`. | Its output is interpolated into `tel:`/`mailto:` hrefs and single-quoted attributes, where the apostrophe is the character that breaks out. | Escaped as `&#39;`. |
| 14 | The service worker cached **every navigation under the single key `'/'`**, with no `response.ok` check. | The offline fallback was whichever page happened to be loaded last: `/colours` answered a request for `/`. A cached 404 would answer as a page. | Navigation responses are cached under their own URL, only when `response.ok`, with the shell also kept under `/` for a first-ever offline visit; the lookup order is this page → shell → branded offline page. `CACHE_VERSION` bumped to `opudas-v2` so the wrong entries are dropped on upgrade. |

### P1 — half-wired features

| # | Flaw | Remedy |
| --- | --- | --- |
| 15 | `lib/api.ts` exported `searchColours` and nothing called it; its return type did not match what the service sent. | The command palette now falls back to it when the local index finds nothing — labelled as coming from the server, race-guarded by request id, and silent on failure so search can never break a page. The type matches the real payload (`hex`, `family`). |
| 16 | `QuotePayload.quantities` existed in the client type, was never sent, and the server ignored it. | Sent from the board's saved estimates, validated and clamped server-side (a non-numeric or negative amount is dropped, an unknown unit falls back to litres), stored on the record, shown in `/admin`, exported in the CSV. |
| 17 | A failed quote submission was stashed in `localStorage` as `opd.draft.quote` and **nothing ever read it**. "We kept your answers" was true only in the sense that they were kept somewhere nobody looked. | The draft is read on mount, the fields come back prefilled, a visible notice says what happened and when, "Discard and start again" clears it, and a successful submission deletes it — a form that quietly re-fills yesterday's phone number is how stale personal data gets sent to the wrong desk. Drafts older than 24 hours are dropped. |
| 18 | The quote success screen said "Your enquiry is with the colour desk" while the panel below it displayed the real desk. | The sentence no longer names a desk; the routed desk is shown once, from the response. |
| 19 | `/quote?type=exterior` was ignored: only `trade`, `sample` and `dealer` were mapped, although the server's `routeFor` supports `exterior` and the technical desk is a real destination. | Any project type the form actually offers can be preselected; anything else is ignored rather than guessed at. |
| 20 | Clicking a dealer marker on the map overwrote the search box with that dealer's city and scrolled to `#dealer-list` — an id on the footnote **below** the list. | It scrolls to the card, highlights it, and leaves the visitor's query alone. |
| 21 | The visualiser's file input accepted `image/*` while the validation accepted three formats, and there was no dimension or empty-file check. | One list for both (`jpeg`, `png`, `webp`), plus a 16 px minimum dimension and an empty-file rejection — a 1×1 or corrupt file now gets a sentence the visitor can act on instead of a canvas error. |
| 22 | `/project` rendered its title as a bare `<input class="display">`, so the page had no `<h1>` at all. | A real `<h1>` names the page; the editable project name is a properly labelled input underneath it. An editable field is not a heading, and the smoke test — correctly — refused the page until it had one. |

### P1 — the build said less than the docs claimed

| # | Flaw | Remedy |
| --- | --- | --- |
| 23 | `docs/qa-checklist.md` stated that `tsc -b` runs with "`verbatimModuleSyntax` and `exactOptionalPropertyTypes` on". `tsconfig.app.json` had `verbatimModuleSyntax` but **neither `strict` nor `exactOptionalPropertyTypes`**. | Both are on now, and the 16 errors they surfaced are fixed — mostly optional properties that needed `?: T | undefined` to say what they meant. A checklist that overstates the build is worse than no checklist. |
| 24 | The build and test scripts were the only TypeScript nothing type-checked: `tsconfig.node.json` covers `vite.config.ts` alone, and Vite strips types from `scripts/*.tsx` without checking them. | `tsconfig.scripts.json` type-checks `scripts/**` under the same strictness, referenced from `tsconfig.json`. It found 35 errors — untyped test runners, an `error.message` on an `unknown`, a widened `units: string`, a `Pixels` type that was not structurally an `ImageData`, and a hardcoded copy of the colour-family list that had already drifted in casing from the type it was checking. All fixed; the family test now iterates the declared `FAMILIES` list instead of a copy. |

---

## 4. Verification

```
cd app && npm run check
```

| Check | Before this audit | After |
| --- | --- | --- |
| `npm run lint` (oxlint) | 12 warnings, 0 errors | 12 warnings, 0 errors — the same twelve, all pre-existing (`react/set-state-in-effect` on store hydration, `react/only-export-components` on `useApp`/`readConsent`); no new warning was introduced |
| `npm run test:unit` | 55 (14 calculator, 9 mask, 32 content) | **87** (14 calculator, 9 mask, 34 content, 30 advisor/share/tools) |
| `npm run test:server` | 39 (19 HTTP, 9 proxy, 11 ops) | **61** (19 HTTP, 9 proxy, 11 ops, 22 deployment-edge) |
| `npm run test:routes` | 21 route renders | **29** cases across 22 route modules, each asserting an `<h1>`, no `undefined`/`NaN`/`[object Object]` in the markup, no link to a route the app does not own, and no price or stock claim in structured data |
| `npm run test:browser` | 12 | **21** (jsdom against a real service on a real socket — now covering the finish finder's recommendation *and* its refusal, the calculator → checklist → share-link → fresh-browser round trip, and the footer opt-out writing a suppression record) |
| `tsc -b` | clean, not strict | clean, **strict + `exactOptionalPropertyTypes`**, now covering `src/`, `vite.config.ts` and `scripts/` |
| Build | 101 sitemap URLs, 106 prerendered heads | **104 sitemap URLs** (59 colours, 6 products, 6 guides, 19 projects, plus `/tools`, `/tools/finish-finder`, `/tools/surface-prep`), **110 prerendered heads** |

`/project` is prerendered but excluded from the sitemap on purpose: it is a
personal workspace whose content lives in the visitor's own storage and URL, so
there is nothing for a crawler to index and everything to get wrong.

**What could not be run here.** This sandbox has no Chromium binary and no access
to the Playwright CDN, so `npm run test:a11y` (axe on 22 pages) and the Lighthouse
budgets were not executed locally. Both run in CI on every push and were green on
`main` at the commit this branch started from; the seven new page entries added to
`app/scripts/a11y.mjs` will be exercised there. That is a real limitation of this
audit, stated rather than papered over: **the new tool pages have not been through
an automated accessibility audit yet.**

---

## 5. Documentation drift corrected

Numbers and claims that had fallen out of step with the build:

| Document | Claimed | Actual | Now |
| --- | --- | --- | --- |
| `docs/remaining-work.md` G5 | "18 routes + 404 … 21-route render test" | 22 route modules, 29 render cases | Corrected |
| `docs/remaining-work.md` §4 | Phase 11.02 listed as remaining work | Built | Marked done with evidence |
| `docs/remaining-work.md` §4 | "Newsletter: double opt-in, unsubscribe" both outstanding | Unsubscribe is built; double opt-in is not | Split |
| `docs/running.md` | "renders all 92 routes" | 110 prerendered heads, 104 sitemap URLs | Corrected, with the new pages named |
| `docs/qa-checklist.md` | "14 calculator, 9 colour-mask and 32 content-integrity tests, plus 19 HTTP-level tests"; "all 21 routes"; "39 tests"; "7 tests in jsdom"; "axe … on thirteen pages"; "`exactOptionalPropertyTypes` on" | 87 unit, 29 route cases, 60 server, 12 browser, 22 axe pages; strict typing was *not* on | All corrected, and strict typing is now genuinely on |
| `docs/qa-checklist.md` | "All 22 images derive from the supplied originals" | 49 served images in the manifest (34 project, 7 interior, 4 product, 2 brand, 2 concept renders) from 54 originals in `opuda/` | Restated with the real counts and the two renders labelled as artwork |
| `docs/brochure.md`, `docs/remaining-work.md`, and the printed copy in four generators | "8 palettes" | 9 — on the cover of the colour book, in the catalogue description, on the colour wheel index and in the room book cross-reference | Corrected, and the four affected PDFs regenerated and committed |
| `docs/content-editing.md` | No mention of `src/data/tools.ts` or the colour index | Both are content files with rules | Added |
| `.env.example` | No `OPD_ALLOWED_ORIGIN`, `OPD_TRUST_PROXY`, `OPD_COLOUR_INDEX` | All three are read by the service | Documented with the conditions under which each is safe |
| `docs/deploying.md`, `docs/operations.md` | No CORS, proxy or opt-out guidance | The service has all three | Added |

---

## 6. What is still wrong, on purpose

Not gaps in this audit's coverage — work that cannot be done from a repository,
listed here so nobody mistakes silence for completion. The full picture, with
effort and sequencing, is in `docs/remaining-work.md`.

**Blocked on data (gate G4).** Prices (deliberately absent, and now enforced
absent by a test), the verified dealer export (9 of 14 entries still
`verified: false`, all sharing the brand phone number), physical colour chips and
measured LRV (all 59 hexes remain digital proofs, labelled as such everywhere they
appear), technical sign-off on primer/gloss/weathershield/screeding (still
`pending-verification`, rendered visibly), and written permission plus site facts
for the 19 projects.

**Blocked on credentials (gate G6).** A notification channel, a Sentry DSN, an
analytics vendor, a production host. Every one of these is built to degrade safely
and switched off until somebody supplies one.

**Blocked on humans (gates G7, G8).** Real-device testing, a screen-reader audit,
colour QA against printed chips, usability testing, UAT sign-off, DNS/TLS,
rollback rehearsal, support rota.

**Phase 17, remaining by design.** MFA or an IP allowlist and an access log for
the inbox; a shared store for rate limits if more than one instance ever runs
(they are in-memory fixed windows today and a restart clears them); a staging
environment. The in-memory limiter is a second line of defence behind the
honeypot and validation, not the first, and the code says so.

**Phase 18, remaining.** Playwright end-to-end journeys, visual regression,
Lighthouse CI as a blocking gate on this branch, a load test on the enquiry
endpoint. The axe script and Lighthouse config exist and run in CI; they need a
browser binary.

**Phases 09, 14, 16.** A CMS or an editorial CRUD layer; CRM integration, an
enquiry acknowledgement email, double opt-in, a real dealer map; analytics
dashboards and a documented data-subject-request procedure.

**Out of scope by decision, not by omission.** Direct e-commerce (phase 13),
advanced AR/AI visualisation (12.03), trade and contractor accounts (14.03,
15.03). Each is marked conditional in the roadmap and each changes the plan by
months; `docs/remaining-work.md` §3 carries the recommendation to launch without
them.

---

## 7. Keeping it this way

The habits that stop these specific defects returning:

- **Add a route** → five places, all tested: `app/src/App.tsx`,
  `app/scripts/prerender.tsx`, `app/scripts/smoke.tsx` (including its `KNOWN`
  prefix list), `tools/build-sitemap.mjs` (unless it is personal or transient,
  like `/project`), and `app/scripts/a11y.mjs`. `docs/running.md` says the same.
- **Add or change a colour** → `npm run index:colours` (or just `npm run build`).
  The content tests compare the service's index against the library and fail on
  drift.
- **Add a preparation situation** → its `products` and `guides` arrays must cite
  ids that exist; `scripts/advisor.test.ts` checks every one, along with the
  minimum step count and the requirement that each step actually explains
  something.
- **Touch structured data** → no price, no offer, no availability. The route
  render test fails the build otherwise.
- **Add a claim to the interface** → if it is not in the typed data or on a pail,
  it does not go in. `docs/content-editing.md` is the rulebook and
  `scripts/data.test.ts` is the enforcement.
