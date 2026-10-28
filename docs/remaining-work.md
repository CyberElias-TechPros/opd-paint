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
| **G5** Feature completeness | Core pages and journeys | ✅ Met | 18 routes + 404, all five core journeys work, 21-route render test. Needs a human review pass. |
| **G6** System readiness | Integrations, security, monitoring | ⚠️ Technical half done | Notifications, error intake, structured logs, a restore drill, dependency/secret scanning, axe and Lighthouse gates now exist and run in CI. What is still missing is not code: the credentials for a real notification channel and a Sentry DSN are not issued, the production host is not provisioned, and nobody yet owns the alert. |
| **G7** Acceptance | Functional, a11y, device, colour, UAT | ❌ Not met | Automated tests pass. No real-device testing, no assistive-technology audit, no colour QA against physical chips, no user acceptance testing. |
| **G8** Launch | Go/no-go, rollback, smoke, support | ❌ Not started | No production environment, no DNS/TLS, no rollback exercise, no support rota. |
| **G9** Handover | Ownership, docs, training | ⚠️ Partial | Four good documents exist (`running`, `content-editing`, `deploying`, `qa-checklist`). No training, no support ownership, no maintenance calendar. |

**Read that as: G3 and G5 are done; G0–G2 and G9 are nearly done; G4, G6, G7, G8
are the real work.**

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
| 4 | ~~**Backups are never restored.**~~ **Done and drilled.** `tools/restore.sh` restores with traversal checks and quarantines damaged lines; `tools/verify-restore.sh` proves the whole round trip on every CI run. | Restoring a *real* archive quarterly remains a human habit, not a script. |

### Phase 09 — Content management (the biggest remaining build)

- Headless CMS (Sanity/Payload/Directus) or an admin CRUD layer over the typed
  data, for colours, products, guides, projects, dealers and palettes.
- Editorial roles, draft/publish, preview, media library, scheduled publishing.
- Migration of the 59 colours, 6 products, 6 guides, 19 projects and 14 dealers.
- Content-operations guide update; the Git-based workflow in
  `docs/content-editing.md` becomes the fallback rather than the method.
- **Effort: 5 days bought-in headless, 15–20 days built.**

### Phase 14 — Lead routing and communication

- CRM integration or webhook routing per desk, with retry and failure alerting.
- Transactional email: enquiry acknowledgement to the customer, notification to
  the desk, CSV/label attachments where useful.
- Newsletter: double opt-in, unsubscribe, list integration.
- Dealer finder: a real map (privacy-respecting tile provider) or a deliberate
  decision to stay with the current schematic plus list.
- **Effort: 4–6 days.**

### Phase 11.02 — The missing decision-support tools

- Finish-selection tool (surface → finish → product) as a guided flow, not a
  filter. *(0.5 day)*
- Surface-preparation decision support: what to do for new render, old gloss,
  damp, efflorescence, salt air. *(1 day)*
- Project checklist export (what to buy, in what order, what to check off).
  *(1 day)*
- Share a project: a durable link rather than the current clipboard message
  *(1–2 days; needs a tiny backend or URL-encoded state)*.
- **Effort: 3–5 days.**

### Phase 16 — Measurement

- Wire the existing consent-gated event layer to a chosen analytics vendor, with
  consent mode, and build four dashboards: journeys, quote funnel, colour
  engagement, content. *(2 days)*
- Cookie policy alignment and a documented data-subject-request procedure.
  *(1 day + counsel)*

### Phase 17 — Security and reliability hardening

- Dependency and secret scanning in CI (Dependabot, `npm audit`, gitleaks).
  *(0.5 day)*
- MFA on the enquiry inbox, IP allowlist option, and an access log. *(1 day)*
- Structured logs (JSON), request IDs, log retention. *(1 day)*
- Uptime monitoring on `/api/health` with an alert that reaches a phone.
  *(0.5 day)*
- Staging environment separate from production, with its own credentials.
  *(1 day)*
- Rate limiting to a shared store if more than one instance ever runs. *(1 day)*
- **Effort: 5–6 days**, plus a penetration test if commerce is approved.

### Phase 18 — The testing that is still missing

| Test | Status | Effort |
| --- | --- | --- |
| Unit, content-integrity, server, route render | ✅ Done (28 + 21) | — |
| Browser end-to-end (Playwright: quote, calculator, visualiser, dealer search) | ❌ | 4 days |
| Automated accessibility (axe on every route) | ❌ | 1 day |
| Visual regression on key pages | ❌ | 2 days |
| Lighthouse budgets in CI (LCP, CLS, INP on 3G) | ❌ | 1 day |
| Manual screen-reader audit (NVDA + VoiceOver) | ❌ | 2–3 days + fixes |
| Real-device testing on a low-end Android over throttled 4G | ❌ | 2 days |
| Usability testing with 5–8 real customers | ❌ | Human time, 1–2 weeks elapsed |
| Colour QA: screen vs printed chip vs drawdown | ❌ | Needs the physical deck |
| Load test on the enquiry endpoint | ❌ | 1 day |

### Phase 19–20 — Launch and operations

- Provision production (container host or platform), with TLS and DNS. *(1–2 days)*
- Rollback plan and a rehearsed rollback. *(0.5 day)*
- Go/no-go checklist, launch-day runbook, production smoke test. *(1 day)*
- Support ownership: hours, escalation path, response times, and who reads the
  inbox. *(Business decision, then 0.5 day to document)*
- 30-day stabilisation review with defined metrics. *(Scheduled)*
- Maintenance calendar: dependency updates, content review, annual document
  revision, backup verification. *(0.5 day)*

### Phase 22 — Handover

- Training for whoever edits content (2 sessions, recorded).
- Operational runbook: what to do when a form breaks, when the disk fills, when
  an enquiry is disputed.
- Architecture decision records for the three choices that will be questioned
  later: static site + tiny Node service, typed data over a CMS, no e-commerce.
- **Effort: 2–3 days.**

---

## 5. Cross-cutting requirements A–F

| | Status | Remaining |
| --- | --- | --- |
| **A. Trust and accuracy** | ✅ Strong | Systemic: this is the strongest part of the build. Remaining risk is only the provisional data in §2. |
| **B. Accessibility** | ⚠️ Designed in, unverified | Everything is keyboard-operable, focus-visible, reduced-motion aware, never colour-only. **Not yet verified with a real screen reader or an automated audit.** |
| **C. Performance** | ⚠️ Budgeted, unmeasured | 118 kB gzip entry, lazy routes, WebP, preloaded hero, lazy fonts. **No measurement on a real Nigerian mobile connection.** Lighthouse CI closes this. |
| **D. Security and privacy** | ⚠️ Good baseline | Headers, CSP, constant-time auth, rate limits, honeypot, consent-gated analytics. **Missing: monitoring, MFA, scanning, DSAR process, legal review.** |
| **E. Maintainability** | ⚠️ Good, one hole | Typed data, tests, generated documents, reproducibility checks, four docs. **The hole is content editing without a CMS.** |
| **F. Commercial integrity** | ✅ Strong | No price is ever shown — every inquiry routes to a person. `pending-verification` flags, no invented testimonials, no stock claims, concept work labelled as concept. |

---

## 6. Recommended sequence

Five stages, each ending in a gate that the README defines. Do not skip a gate
to hit a date — the README is explicit about that.

**Print collateral — ✅ the colour book**
A dealer-facing A5 brochure, 32 pages, generated from the same data the website
serves: nine family chapters, eight palettes with a role per wall, the jobs on the
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
- [ ] Content can be changed by a non-engineer, or the reason it cannot is a
      written decision rather than an omission.
- [ ] Support ownership, escalation and a maintenance calendar exist.
- [ ] The two conditional scope decisions (commerce, AR) are recorded as
      in or out, with reasons.

---

## 8. Honest summary

| Area | Completion |
| --- | --- |
| The website itself (design, pages, journeys, tools) | **~95%** |
| Automated engineering quality (tests, CI, reproducibility, a11y gates) | **~92%** |
| Truthful content model and guardrails | **~90%** |
| Authoritative product and colour data | **~15%** |
| Verification with real users and assistive tech | **~0%** |
| Production operations (deploy, monitor, back up, support) | **~45%** — the machinery exists and is drilled; nothing is provisioned and nobody is on call |
| Content management for non-engineers | **~0%** |
| Whole project against all 75 roadmap task groups | **~57%** |

The remaining half is not more design or more features. It is **data, evidence,
operations and decisions** — which is exactly what the roadmap says the second
half of a project like this always is.
