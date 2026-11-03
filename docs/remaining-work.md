# What is left to finish

A complete gap analysis against the roadmap in the root `README.md` (phases 00–22,
release gates G0–G9, cross-cutting requirements A–F). It answers one question:

> **What is actually left before this can be called a finished project, and not
> merely a finished website?**

Short answer: **the website is essentially built. The project is not finished.**
What remains is mostly not code — it is authoritative data, operating
infrastructure, verification with real humans, legal sign-off, and two scope
decisions the business still has to make.

Everything below is stated as *not done* unless there is evidence that it is.
That is the README's own standard, and it is the right one.

---

## 1. Where the project stands, gate by gate

| Gate | Meaning | Status | What is blocking it |
| --- | --- | --- | --- |
| **G0** Governance | Owners, tracker, approvals | ⚠️ Partial | The roster and tracker exist in the README but are not live. Nobody is named as accountable for any phase, and no approval record exists. |
| **G1** Discovery | Validated needs, model, goals | ⚠️ Partial | Business model and market are assumed (lead generation, Nigeria, Port Harcourt), not validated. No customer interviews or analytics baseline. |
| **G2** Requirements | Prioritised scope, traceability | ⚠️ Partial | Functional requirements are written. A traceability matrix (requirement → build → test) is not maintained, and nothing is signed off. |
| **G3** Design | Journeys, wireframes, system, a11y | ✅ Nearly met | Design system, journeys and accessibility rules are built and documented (`/style-guide`). Missing only formal review and approval. |
| **G4** Data & architecture | Data model, integrations, cost | ❌ Blocked | The *model* is good. The *data* is provisional: unverified dealers, unmeasured colours, unsigned product specs. Pricing is deliberately not part of the data model at all — see §2. No operating-cost assessment. |
| **G5** Feature completeness | Core pages and journeys | ✅ Met | 22 route modules + 404, all five core journeys work, and the phase 11.02 decision-support tools are built (finish finder, surface preparation, project checklist, durable share link, saved estimates). A 29-case render test asserts an `<h1>`, clean markup and honest structured data on every one. Needs a human review pass. |
| **G6** System readiness | Integrations, security, monitoring | ⚠️ Technical side essentially done | Notifications with retries, per-channel health and a `channel_down` alert; customer acknowledgement; error intake; structured logs with request IDs; **automated retention matching the published notice**; a **DSAR intake with a statutory clock** and an erasure tool; **roles, TOTP, signed sessions, an IP allowlist and an access log on the inbox**; **durable rate limiting and duplicate suppression**; a restore drill, a load test, an uptime check that asserts rather than pings (scheduled in CI, opening and closing its own issue), dependency and secret scanning, axe and Lighthouse gates; and the deployment edges — CORS, proxy trust, a generated colour index, a traversal-safe static root, CSV formula-injection escaping, a newsletter opt-out. What is still missing is not code: the credentials for a real notification channel and a Sentry DSN are not issued, the production host is not provisioned, the dead-man's-switch account does not exist, and nobody yet owns the alert. |
| **G7** Acceptance | Functional, a11y, device, colour, UAT | ❌ Not met | Automated tests pass. No real-device testing, no assistive-technology audit, no colour QA against physical chips, no user acceptance testing. |
| **G8** Launch | Go/no-go, rollback, smoke, support | ⚠️ Written, not executed | The plan exists and is executable: [`launch-runbook.md`](launch-runbook.md) (owners, SLO/RTO, pre-launch checklist, launch-day order with a verification per step, go/no-go, the first 72 hours, the ongoing cadence), `tools/smoke-production.mjs` (21 checks, release-stamp aware), `tools/rollback.sh` (`--snapshot`, `--check`, rollback with a health poll). What is missing is the environment to run it against: no production host, no DNS/TLS, no snapshot taken on a real deploy, no support rota. |
| **G9** Handover | Ownership, docs, training | ⚠️ Partial | Eleven documents now exist (`running`, `content-editing`, `deploying`, `operations`, `launch-runbook`, `qa-checklist`, `brochure`, `catalogue`, `campaign-the-approval-call`, `remaining-work`, `implementation-audit`) plus three ADRs and a fully documented `.env.example`. The maintenance calendar is written (`launch-runbook.md` §5). What is missing is human: no training sessions, and no named owner for the inbox or the alerts. |

**Read that as: G3 and G5 are done; G0–G2, G6 and G9 are nearly done and blocked on
people rather than code; G4, G7 and G8 are the real work — authoritative data,
verification with humans, and a production environment.**

---

## 2. The critical path: seven things only the business can supply

No amount of engineering closes these. Every one of them is currently faked,
flagged, or omitted — correctly — and each blocks a gate.

1. **Pricing.** The site deliberately does not publish any price: no authoritative
   price list exists yet, and inventing a guide figure would be worse than
   omitting it. Every pack-size, calculator and product surface instead leads to
   WhatsApp, the quote form or a dealer. If pricing is published later, it must
   come from a real price file (CSV/feed/API) with pack prices, VAT treatment and
   effective dates — not from this codebase.
2. **The verified dealer export.** 14 entries, 9 marked `verified: false`, all
   using the brand phone number. Required: real names, addresses, coordinates,
   direct phone numbers, opening hours, and which services each actually offers.
3. **Physical colour chips and measured LRV.** All 59 colours carry a hex value
   that is a *digital proof*. Required: a physical fan deck or drawdowns, and
   ideally spectrophotometer readings to fill in `measuredLrv`.
4. **Technical sign-off on the range.** Matt and Silk claims are transcribed from
   the pail. Primer, Gloss, Weathershield and Screeding are marked
   `pending-verification`. Required: the technical owner's approval of coverage,
   drying times, coats, and guarantee terms.
5. **Photography permissions and project metadata.** None of the 19 projects has
   client permission on record, an area, or a duration, and 13 of the 19 (added
   from later batches of site photography with no accompanying job sheet) also
   carry no colour, product or palette link — `colorIds`/`productIds` are left
   empty and `paletteId` is `''` rather than guessed at, and their copy is kept
   to what is visibly true of the photograph. Required: written permission and
   the site facts for all 19, plus the colour/product record for the 13, or they
   stay reduced to what is certain.
6. **Legal review.** Privacy, terms, the accessibility statement and the
   guarantee wording are drafts written by an engineer. Required: review by a
   Nigerian lawyer familiar with the NDPA 2023, plus a data-protection point of
   contact and a subject-access process.
7. **Domain and sending domain.** `opudapaint.com` is assumed in the sitemap,
   canonicals and PDF feet. Required: confirmation of ownership, DNS access, and
   SPF/DKIM/DMARC records for the address enquiries will be sent from.

---

## 3. Scope decisions that must be made before more is built

The roadmap marks these "conditional". They are not gaps; they are unanswered
questions, and the answer changes the work by months.

| Decision | If **yes** | If **no** |
| --- | --- | --- |
| **Direct e-commerce** (phase 13) | Cart, checkout, Paystack/Flutterwave integration, inventory, fulfilment, refunds, reconciliation, provider approval: **20–40 days** plus a payment account | Nothing. Quote-and-dealer journeys stay the end of every path. |
| **Advanced AR / AI visualisation** (12.03) | Wall segmentation, device-compatibility matrix, cost model, honest-limitation UI: **15–30 days** | The current photo visualiser stays, with its limitation notice. |
| **Trade/contractor accounts** (14.03, 15.03) | Auth, saved projects across devices, trade price lists, order history: **10–15 days** | Project board stays per-browser local storage. |
| **Testimonials and case-study names** | Permission management and content work | Stays deliberately absent. |

**Recommendation:** launch without commerce. The roadmap itself sequences
commerce as conditional, the data needed to sell online (verified prices and
stock) does not exist yet, and every journey already ends in a phone call, a
dealer visit or a quote — which is what the business actually does today.

---

## 4. Engineering work that can be done now, without new data

Grouped by phase. Effort is indicative engineering time, not elapsed time.

### Fix first (live problems)

| # | Item | Why it matters now |
| --- | --- | --- |
| 1 | ~~**The Vercel project is misconfigured.**~~ **Done.** `app/vercel.json` builds the app, publishes `dist`, serves `/api/*` from `app/api/[...path].js`, and sets the security headers. The project's Root Directory is `app`, which is where the platform looks for both. | Needs one Vercel environment variable, `OPD_API_ORIGIN`, pointing at the enquiry service — and the service itself must be hosted somewhere. Until then the form fails honestly and keeps the answers on the device. |
| 2 | ~~**No enquiry notification.**~~ **Built**, not yet *switched on*. Webhook and Resend email channels, retries, an audit file and a startup warning when nothing is configured. | The channel credentials are not issued, so production still announces nothing until `OPD_NOTIFY_WEBHOOK` or `OPD_RESEND_API_KEY`/`OPD_NOTIFY_EMAIL`/`OPD_NOTIFY_FROM` are set. See `docs/operations.md`. |
| 3 | ~~**No error monitoring.**~~ **Built**, both halves: browser reports to `/api/errors` (scrubbed, rate-limited, no PII), server faults logged structurally, optional Sentry forwarding. | A Sentry DSN (or a decision to rely on the JSONL and the log drain) is still a human step. |
| 4 | ~~**Twenty-odd defects that only appear in a deployment or in structured data.**~~ **Done.** Fabricated prices and stock claims removed from 59 pages of JSON-LD and guarded by a test; the colour search endpoint no longer parses TypeScript sources the runtime image does not contain; CORS, proxy-aware rate limiting, the static-root traversal guard, CSV formula injection, unstored routing, the service worker's single-key navigation cache, and five half-wired features (server search, quote quantities, the recovered draft, `?type=exterior`, the dealer map marker). Every one is listed with its remedy and its test in [`implementation-audit.md`](implementation-audit.md). | Each of these passed the tests that existed for it, which is the reason the audit added over sixty checks rather than only fixes. |
| 5 | ~~**Backups are never restored.**~~ **Done and drilled.** `tools/restore.sh` restores with traversal checks and quarantines damaged lines; `tools/verify-restore.sh` proves the whole round trip on every CI run. | Restoring a *real* archive quarterly remains a human habit, not a script. |

### Phase 09 — Content management (the biggest remaining build)

- Headless CMS (Sanity/Payload/Directus) or an admin CRUD layer over the typed
  data, for colours, products, guides, projects, dealers and palettes.
- Editorial roles, draft/publish, preview, media library, scheduled publishing.
- Migration of the 59 colours, 6 products, 6 guides, 19 projects and 14 dealers.
- Content-operations guide update; the Git-based workflow in
  `docs/content-editing.md` becomes the fallback rather than the method.
- **Effort: 5 days bought-in headless, 15–20 days built.**

### Phase 14 — Lead routing and communication

- CRM integration or webhook routing **per desk**, with a retry queue. Routing and
  the SLA per desk are built (`routingFor()` in `server/index.mjs`: trade, sample,
  dealer, exterior, default); failure alerting is built (`notify.channel_down` at
  three consecutive failures, per-channel health in `/api/health`). What is not
  built is a separate webhook URL per desk and a queue that retries hours later —
  both need a decision about who owns which channel.
- ~~Transactional email: enquiry acknowledgement to the customer, notification to
  the desk.~~ **Done.** The desk gets the lead; the customer gets their reference,
  the desk it went to, the response commitment, the phone number, the words
  "estimate, not a quotation" and the data-subject route (`OPD_ACK_CUSTOMER`).
  CSV/label attachments are still open and still need a reason.
- Newsletter: double opt-in and list integration. (Unsubscribe is built —
  `POST /api/unsubscribe` writes a suppression record and the footer offers it —
  because the footer already promised it. Double opt-in needs an email vendor
  decision and a confirmation-token store.)
- Dealer finder: a real map (privacy-respecting tile provider) or a deliberate
  decision to stay with the current schematic plus list.
- **Effort: 4–6 days.**

### Phase 11.02 — The missing decision-support tools — ✅ built

All four P1 task groups are implemented, plus the hub that lists them and the
calculator-to-project link (11.01.15) the checklist needs to be useful:

- **11.02.01 Finish finder** — `/tools/finish-finder`: four questions answered by
  an explicit, explainable rule table (`app/src/lib/advisor.ts`), returning a
  topcoat, a runner-up, primer or screed where the substrate needs one, the coat
  count from the product's own data sheet, a preparation sequence and the reasons
  in sentences. Where the honest answer is "fix the building first" — a damp wall
  — it recommends nothing and says why.
- **11.02.02 Surface preparation** — `/tools/surface-prep` and
  `?situation=<id>`: ten situations with recognition signs, ordered steps, the
  products in the order they are used, guide links and hard stops, plus `HowTo`
  structured data.
- **11.02.03 Palette pairing** — already satisfied by `ColourDetail`, which shows
  the palettes a colour belongs to and the role it plays in each; the new tools
  link into it rather than duplicating it.
- **11.02.04 Project checklist** — `/project`: measure, confirm, buy, prepare,
  apply, cure, built from the board and exported as print, clipboard text or a
  `.txt` download.
- **11.02.05 Share a project** — a durable link that *is* the state: bounded JSON
  in base64url on `/project?s=` (`app/src/lib/share.ts`). No backend, no account,
  no personal data, and defensive decoding because a shared link is untrusted
  input.
- **11.02.06 / 11.02.07 remain deliberately unbuilt.** Both are P2, and 11.02.07
  is gated in the roadmap on validating its utility and safeguards first.

Evidence: `app/src/routes/{Tools,FinishFinder,SurfacePrep,Project}.tsx`,
`app/src/data/tools.ts`, `app/src/lib/{advisor,share}.ts`, and 30 tests in
`app/scripts/advisor.test.ts`. Detail in
[`implementation-audit.md`](implementation-audit.md) §2. **Effort spent: ~4 days.**

### Phase 16 — Measurement

- Wire the existing consent-gated event layer to a chosen analytics vendor, with
  consent mode, and build four dashboards: journeys, quote funnel, colour
  engagement, content. *(2 days)*
- ~~A documented data-subject-request procedure.~~ **Built, end to end.**
  `POST /api/privacy` takes the right being exercised, gives it a `DSAR-`
  reference and a 30-day `dueBy`, rate limits it while still naming the human
  route, announces it to the desk with the statutory deadline in the body, stores
  it, and logs `privacy.request_received`. Fulfilment is a tool rather than an
  editor session (`tools/erase-record.mjs`: dry run by default, suppression entry,
  audit line with references only). The procedure is written down in
  [`operations.md` §5d](operations.md). The cookie policy is aligned with what the
  build actually does — no tracker, no cookie set by us — and the retention periods
  published in the privacy notice are the ones the service enforces.
  **Still needs counsel** (16.03.05), and still needs a person to answer requests.

### Phase 17 — Security and reliability hardening

- ~~Dependency and secret scanning in CI (Dependabot, `npm audit`, gitleaks).~~
  **Done.**
- ~~Cross-origin policy and proxy-aware rate limiting.~~ **Done:**
  `OPD_ALLOWED_ORIGIN` and `OPD_TRUST_PROXY`, both tested in
  `server/edge.test.mjs`. Neither is on by default, and the trust flag is only
  safe behind a proxy that overwrites `X-Forwarded-For`.
- ~~MFA on the enquiry inbox, IP allowlist option, and an access log.~~ **Done.**
  TOTP per account (`server/auth.mjs`: RFC 4226 vectors, ±1 step tolerance,
  timing-safe comparison), two roles (`viewer` reads, `exporter` downloads the
  CSV), signed session cookies, an optional CIDR allowlist that answers 404 rather
  than 403, and ten distinguishable decisions written to `admin-access.jsonl` and
  logged as `admin.access`. 23 checks in `server/admin.test.mjs`.
- ~~Structured logs (JSON), request IDs, log retention.~~ **Done.** One JSON object
  per line in production, `X-Request-Id` on every response and in every log line,
  and retention that runs at startup and daily: 30 days for operational logs, 24
  months for enquiries and data-subject requests, subscriptions never pruned,
  suppression records never pruned, undated lines kept rather than guessed at.
- ~~Uptime monitoring on `/api/health` with an alert that reaches a phone.~~
  **Built; the phone is the gated half.** `tools/uptime-check.mjs` runs six probes
  that each assert something about the response, and `.github/workflows/uptime.yml`
  runs it every fifteen minutes, opening one issue on failure and closing it on
  recovery. Reaching a phone needs two things only a human can supply: a
  dead-man's-switch URL (`OPD_UPTIME_HEARTBEAT`) and a notification channel on that
  service.
- ~~Staging environment separate from production, with its own credentials.~~
  **Documented and reproducible** (`deploying.md` §Staging: same image, own data
  volume, own credentials, throwaway webhook, the checks pointed at it). *Provisioning
  the host* is the remaining half and needs an account and a domain.
- ~~Rate limiting to a shared store if more than one instance ever runs.~~ **Done**
  for one instance and for instances sharing a volume: `server/limits.mjs` is an
  append-only JSONL store refreshed on change, with a documented per-process
  fallback that reports itself in `/api/health` as `limits.store: "memory"` and
  logs `limits.write_failed`. Two instances on *separate* volumes still each get
  their own allowance, which is the honest limit of a file-backed store — Redis is
  the answer if that ever happens (17.02.06).
- **Remaining effort: 1–2 days** (a penetration test, plus the host and vendor
  accounts above).

### Phase 18 — The testing that is still missing

| Test | Status | Effort |
| --- | --- | --- |
| Unit, content-integrity, server, route render | ✅ Done (server suite is now 112 checks across 7 files) | — |
| Browser end-to-end in jsdom (quote, calculator, tools, project, footer, room preview, privacy form) | ✅ Done (28) | — |
| Browser end-to-end on real Chromium (Playwright: dealer geolocation, visual regression, pixels) | ❌ jsdom has no canvas implementation, so the room preview's *pixels* are only checked by axe and Lighthouse in CI | 4 days |
| Automated accessibility (axe on 22 pages, in CI) | ✅ Runs on every pull request — and caught three contrast defects on a new page that no local check could see | — |
| Visual regression on key pages | ❌ | 2 days |
| Lighthouse budgets in CI (LCP, CLS, TBT, weight caps) | ✅ Green on every pull request | — |
| Manual screen-reader audit (NVDA + VoiceOver) | ❌ | 2–3 days + fixes |
| Real-device testing on a low-end Android over throttled 4G | ❌ | 2 days |
| Usability testing with 5–8 real customers | ❌ | Human time, 1–2 weeks elapsed |
| Colour QA: screen vs printed chip vs drawdown | ❌ | Needs the physical deck |
| Load test on the enquiry endpoint | ✅ `tools/load-test.mjs` — concurrency with a p95 and error-rate budget, 429s counted separately from failures, a honeypot body so nothing is stored, and `--vary-ip` that reports whether the deployment actually trusts `X-Forwarded-For`. Run it against staging. | — |

### Phase 19–20 — Launch and operations

- Provision production (container host or platform), with TLS and DNS. *(1–2 days,
  and needs an account)*
- ~~Rollback plan and a rehearsed rollback.~~ **Done.** `tools/rollback.sh`:
  `--snapshot` before a deploy (timestamped image tags, or an archive of the
  release that excludes `data/` so enquiries survive), rollback with automatic mode
  detection for Docker or systemd, then a health poll that requires
  `storage: ready`. `--check` answers "is there something to go back to?" without
  changing anything, and is the monthly drill.
- ~~Go/no-go checklist, launch-day runbook, production smoke test.~~ **Done.**
  [`launch-runbook.md`](launch-runbook.md) (owners, service levels and recovery
  objectives, the pre-launch checklist with a check on every line, launch-day
  order with a verification per step, go/no-go, the first 72 hours, the ongoing
  cadence) and `tools/smoke-production.mjs` (21 checks; fails when the release
  answering is not the release shipped).
- Support ownership: hours, escalation path, response times, and who reads the
  inbox. *(Business decision — the runbook has the table with the blanks in it)*
- ~~30-day stabilisation review with defined metrics.~~ **Defined**, in
  `launch-runbook.md` §4: eight commands to read twice a day, severities with
  responses, "roll back first, diagnose second", and what closing the review
  produces. Running it needs a launch and a calendar entry.
- ~~Maintenance calendar.~~ **Documented** in `launch-runbook.md` §5 (daily to
  quarterly, each with its command). Turning it into reminders is a human habit.

### Phase 22 — Handover

- Training for whoever edits content (2 sessions, recorded). *(Needs the person)*
- ~~Operational runbook.~~ **Done and extended.** [`operations.md`](operations.md)
  covers a form that breaks, a disk that fills, a channel that stops delivering, a
  locked-out inbox user, a leaked credential, a duplicate enquiry, a retention
  failure and a deletion request.
- ~~Architecture decision records.~~ **Done.** [`docs/adr/`](adr/README.md): 0001
  static site plus one small service, 0002 typed data over a CMS, 0003 no
  e-commerce at launch — each with the options rejected and the trigger for
  revisiting it.
- **Remaining effort: 1 day** (the training sessions).

---

## 5. Cross-cutting requirements A–F

| | Status | Remaining |
| --- | --- | --- |
| **A. Trust and accuracy** | ✅ Strong | Systemic: this is the strongest part of the build. Remaining risk is only the provisional data in §2. |
| **B. Accessibility** | ⚠️ Audited by machine, unverified by people | Everything is keyboard-operable, focus-visible, reduced-motion aware, never colour-only. axe runs on 22 pages in CI on every pull request (and caught three contrast defects no local check could see), with keyboard operability, reduced motion and a 360 px layout checked alongside. **No screen reader has been used by a person who relies on one.** |
| **C. Performance** | ⚠️ Budgeted, unmeasured on a real network | 139 kB gzipped entry (432 kB raw), route-level code splitting, lazy routes, WebP, preloaded hero, lazy fonts, a network-first service worker. Lighthouse budgets run in CI and are green, and `tools/load-test.mjs` puts the enquiry path at a p95 of 17 ms locally. **No measurement on a real Nigerian mobile connection on a real device.** |
| **D. Security and privacy** | ✅ Strong baseline, unreviewed by counsel | Headers, CSP (`form-action 'self'`, `frame-ancestors 'none'`), constant-time auth, roles and TOTP on the inbox, an access log, an optional IP allowlist, signed session cookies, durable rate limits, duplicate suppression, a honeypot that answers *identically* to the real endpoint, consent-gated analytics with no bundled tracker, single-origin CORS, proxy-aware limiting, a traversal-safe static root, CSV formula-injection escaping, automated retention that matches the published notice, a DSAR intake with a statutory clock and an erasure tool, a working newsletter opt-out, and uptime monitoring that asserts rather than pings. **Missing: legal review of the notices (16.03.05), a penetration test if commerce is approved, and the human half of paging.** |
| **E. Maintainability** | ⚠️ Good, one hole — now a written decision | Typed data, ~250 automated checks (112 server, 28 browser, 29 route render, plus unit, content-integrity, axe and Lighthouse), generated documents, reproducibility checks, strict TypeScript across `src/`, the config and the test scripts, ten docs including three ADRs and a launch runbook, and `.env.example` documenting every variable the service reads. **The hole is content editing without a CMS — and [ADR 0002](adr/0002-typed-data-over-a-cms.md) is now the reason it is a hole rather than an omission.** |
| **F. Commercial integrity** | ✅ Strong | No price is ever shown — every inquiry routes to a person — and that is now enforced rather than merely intended: the route render test fails the build if any page emits a price, an offer or an availability claim in its structured data. `pending-verification` flags, no invented testimonials, no stock claims, concept work labelled as concept. |

---

## 6. Recommended sequence

Five stages, each ending in a gate that the README defines. Do not skip a gate
to hit a date — the README is explicit about that.

**Print collateral — ✅ the colour book**
A dealer-facing A5 brochure, 32 pages, generated from the same data the website
serves: nine family chapters, nine palettes with a role per wall, the jobs on the
wall, one colour under four lights, the specification table and the arithmetic for
sizing a job, an index by room, and a colophon. Byte-reproducible, so the assets
check treats it like any other committed artefact. Evidence:
`tools/{build-brochure,brochure_copy}.py`, `app/public/documents/opudas-colour-book.pdf`,
`docs/brochure.md`. Linked from the colour library.

**Print collateral — ✅ the room-scheme book**
The companion volume: 20 pages, four methods (aperture, substrate, threshold,
depth) and sixteen colourways rendered onto the company's own site photographs by
a mean-preserving luminance transfer, with the untouched frame printed beside each
set and the repainted area stated as a percentage. Evidence:
`tools/{build-roombook,roombook_copy,roombook_plates}.py`,
`tools/roombook-plates.json`, `app/public/documents/opudas-room-book.pdf`.

**Print collateral — ✅ the colour wheel and the specification sheet**
Two single-sheet reference pieces, prompted by reading Asian Paints' and Berger's
own trade literature side by side with what OPUDA'S had. The colour wheel (A4, 3
pages) is the wall-chart version of the library: all 59 colours as one ring
grouped into the nine families, the full swatch grid, and a contact page. The
specification sheet (A4 landscape, 2 pages) is the trade comparison a dealer or
contractor currently has to assemble from six separate TDS PDFs: finish,
coverage, timing and surfaces for every product on one sheet, with a
label-verified/pending-verification status chip read directly from
`claimsStatus` in `products.ts`, rather than six numbers typed a second time.
No certification claims OPUDA'S does not hold (no ISO marks, no "est." date)
were added to match the references' credentials pages. Evidence:
`tools/{build-colorwheel,build-specsheet}.py`,
`app/public/documents/{opudas-colour-wheel,opudas-spec-sheet}.pdf`,
`docs/brochure.md`. Linked from the colour library and the products page.

**Print collateral — ✅ the master catalogue**
A different genre from the five above: not a new design, but every one of them
— colour book, room book, colour wheel, specification sheet, fan deck and all
twelve technical and safety data sheets — bound into a single 126-page A4
file via a real PDF merge (`pypdf`, byte-reproducible like the rest), plus one
new chapter, the Complete Site Gallery: every real photograph in
`app/src/data/projects.ts`, decoded again and restored for print (contrast,
colour and sharpness lifted by a small fixed amount, not retouched), one page
per project, with its colour chips only where a verified job sheet exists, and
a **CONCEPT RENDER** label on the one project that is architectural artwork
rather than a site photograph. Evidence: `tools/build-catalogue.py`,
`app/public/documents/opudas-catalogue.pdf`, `docs/catalogue.md`. Linked from
the colour library.

**Stage 1 — Make the current build trustworthy — ✅ done, all nine checks green**
Fix the Vercel configuration · enquiry notifications · error monitoring · restore
test · dependency scanning · Lighthouse CI · axe · browser smoke tests.
→ *Closes the G6 technical half.* Evidence: `app/vercel.json`, `app/api/[...path].js`,
`server/{notify,errors,logger}.mjs`, `tools/{restore,verify-restore,scan-secrets,lighthouse-report}.sh|mjs`,
`app/scripts/{browser.test.tsx,a11y.mjs}`, `.lighthouserc.json`,
`.gitleaks.toml`, `.github/dependabot.yml`, and six CI jobs.

Green as of the last commit on this branch: Site (lint, tests, routes, browser,
build), Accessibility, Lighthouse budgets, Dependencies and secrets, Backups
restore, Brand assets reproducible, Vercel, CodeRabbit.

The gates earned their place immediately — they found twenty-odd real defects
that no previous check could see:

| Gate | What it found |
| --- | --- |
| axe | A consent checkbox whose label pointed at a different element; a consent field with two labels; a logo, a search button and every colour card whose accessible name did not contain their visible text; 249 pieces of small print at 4.05:1 contrast. |
| Lighthouse | Every page leaking a soft 404 (a catch-all answering 200 for unknown paths); a footer pushed off screen by the loading state, worth 0.15–0.19 CLS on three pages; an un-preloaded italic face reflowing the largest text on the page; three identical "Read more" links; a footer heading order that skipped a level. |
| Secrets | Nothing, which is the correct result — but the gate is now independent of a download, so it cannot fail to run. |
| Restore drill | A truncated JSONL line made a restore refuse entirely; a rejected restore could still write to the target. |

Everything that needs a credential — a chat webhook, an email sender, a Sentry
DSN, a hosted API origin — is built to degrade safely and is switched off until
someone supplies one. That is the remaining half of G6, and it is not code.

**Stage 2 — Replace provisional data (business-led, 2–4 weeks elapsed)**
Dealer export · product sign-off · colour chips and measured LRV · project
permissions and metadata · legal review. (No price list to replace — pricing is
deliberately not part of the site.)
→ *Closes G4 and most of G1.*

**Stage 3 — Prove it with humans (2–3 weeks)**
Usability testing · screen-reader audit and fixes · device lab · colour QA ·
UAT sign-off.
→ *Closes G7.*

**Stage 4 — Ship it properly (1 week)**
Production infrastructure · DNS and TLS · sending domain · backups verified ·
monitoring and alerting · rollback rehearsal · go/no-go · support rota.
→ *Closes G8.*

**Stage 5 — Hand over, then improve (ongoing)**
CMS (or a written decision to stay in Git) · training · maintenance calendar ·
analytics dashboards · four-week stabilisation · then the growth cycle in
phases 15 and 21.
→ *Closes G9, opens phase 21.*

Commerce, AR and trade accounts are **not** in this sequence. They come after
launch, if at all, and each changes the plan by months.

---

## 7. Definition of "the whole plan is done"

The project is complete when all of the following are true — this is the
README's Definition of Done applied to the whole thing:

- [ ] G0–G9 are closed, each with a named approver and recorded evidence.
- [ ] No price, dealer, colour or spec on the site is provisional or unverified.
- [ ] Every claim traces to a label, a data sheet, or a signed-off document.
- [ ] Accessibility has been verified with assistive technology, not just designed in.
- [ ] Performance has been measured on a real device and network.
- [ ] Production is deployed, monitored, backed up, and a restore has been proven.
- [ ] An enquiry reaches a human within the published SLA, and someone owns that.
- [x] Content can be changed by a non-engineer, or the reason it cannot is a
      written decision rather than an omission. — [ADR 0002](adr/0002-typed-data-over-a-cms.md)
      records the decision, its cost, and what would change it.
- [ ] Support ownership, escalation and a maintenance calendar exist. — the
      calendar and the escalation path are written
      ([`launch-runbook.md`](launch-runbook.md)); the *names* are not, and cannot
      come from a repository.
- [ ] The conditional scope decisions are recorded as in or out, with reasons. —
      commerce is recorded ([ADR 0003](adr/0003-no-e-commerce-at-launch.md), out at
      launch); AR (12.03) and trade accounts (14.03/15.03) remain open in §3.

---

## 8. Honest summary

| Area | Completion |
| --- | --- |
| The website itself (design, pages, journeys, tools) | **~97%** |
| Automated engineering quality (tests, CI, reproducibility, a11y gates) | **~95%** |
| Truthful content model and guardrails | **~93%** |
| Authoritative product and colour data | **~15%** |
| Verification with real users and assistive tech | **~0%** |
| Production operations (deploy, monitor, back up, support) | **~65%** — the machinery exists, is drilled and is now documented to the level of a launch day and a 30-day review; nothing is provisioned, no channel is configured, and nobody is on call |
| Content management for non-engineers | **~0%** |
| Whole project against all 75 roadmap task groups | **~66%** |

The remaining third is not more design or more features. It is **data, evidence,
accounts and decisions** — which is exactly what the roadmap says the second half
of a project like this always is. Everything that could be built without a vendor
account, a credential, a physical product, a lawyer or a person with a phone has
now been built, tested and written down.
