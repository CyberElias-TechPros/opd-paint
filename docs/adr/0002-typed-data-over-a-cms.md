# ADR 0002 — Typed source data instead of a CMS

- **Status:** accepted
- **Date:** 2026-11-03
- **Answers:** roadmap 07.01.02 (which system owns content and products), 09.01 (CMS configuration — deliberately not taken), 22.04 (operating guides), 22.10 (deferred work)
- **Related:** ADR 0001 (the service that reads some of this data at runtime)

## Context

The site is built out of facts: 59 colours with hex, family, finish and
light-reflectance values; 6 products with coverage rates and pack sizes; 9
palettes; 19 project guides; 14 dealers, of whom 6 are still unverified; 6
advice guides; and the surface-preparation and finish-finder logic that turns
those facts into recommendations.

Three things are done with those facts:

1. rendered as pages (prerendered at build time, 110 documents),
2. used in **calculations** — the paint calculator's coverage maths, the finish
   finder's recommendation rules, the room preview's colour blending,
3. rendered as **printed collateral** by the Python tools — the 126-page colour
   catalogue, the brochure, the fan deck, the specification sheets.

Some of it is not yet true. A dealer's phone number may be unconfirmed; a
coverage rate may be from a datasheet nobody has re-read. The project's own rule
(cross-cutting requirement A) is that nothing invented reaches a customer, and
that unverified facts stay visibly unverified until somebody confirms them.

## Decision

**Content and product data live in typed TypeScript modules in the repository,
reviewed by pull request, tested by CI, and consumed by the site build and by the
generators.**

```
app/src/data/colors.ts     the palette: hex, family, finish, LRV, and what each colour is for
app/src/data/products.ts   the six products: coverage rates, pack sizes, finishes
app/src/data/palettes.ts   curated groups of colours, and the rooms they suit
app/src/data/projects.ts   the 19 project guides, each referencing colours and products by id
app/src/data/guides.ts     the advice library
app/src/data/dealers.ts    where to buy — with `verified: false` on the six that are not confirmed
app/src/data/tools.ts      the finish finder and surface-preparation logic, as data rather than code
```

with the discipline that makes it work:

- **Strict types, including `exactOptionalPropertyTypes`.** A colour without a
  hex value is a compile error, not a blank swatch in production.
- **Truth tests.** `app/scripts/data.test.ts` fails the build on a colour whose
  contrast is unreadable, a dealer entry missing a field, a product whose coverage
  rate is implausible, or a claim with no source. Content is tested like code
  because it is load-bearing like code.
- **Explicit uncertainty.** A record that has not been confirmed carries
  `verified: false` (dealers) or `pending-verification` (claims). The flag is
  rendered, not hidden: the site says what it does not know yet.
- **One source, many outputs.** `tools/build-catalogue.py`, `build-brochure.py`,
  `build-fandeck.py`, `build-specsheet.py` and `build-roombook.py` read the same
  facts the site does, and `tools/check-assets.py` proves it: it regenerates every
  committed artefact from `git HEAD` and fails if a single byte differs. A PDF
  that disagrees with the website is a defect CI catches, not a customer complaint.
- **The runtime reads a generated copy where it must.** `server/colour-index.json`
  is generated into the image at build time, because a container that has to parse
  TypeScript at request time is a container that returns 500 in production and
  passes its tests on a laptop.

Editing content is therefore: change a `.ts` file, open a pull request, read the
deploy preview, merge. `docs/content-editing.md` is the guide for somebody who has
never seen the repository.

## Options considered

**A conventional CMS.** Rejected in ADR 0001; the specific loss here would be the
calculations. Coverage rates and LRV are inputs to arithmetic that a customer
relies on to buy the right amount of paint. A rich-text editor cannot type-check
a number, and a CMS field nobody validated becomes a wrong answer on a page
nobody re-read.

**A headless CMS.** Rejected, and this ADR is where the cost is clearest. It would
give a friendly editor in exchange for: a schema that has to be kept in step with
TypeScript types by hand; no way to run the truth tests against draft content
before it is published; no way to generate the printed catalogue from the same
facts without an export pipeline; and content that is only as correct as whoever
typed it last, with no review step. The pull request *is* the editorial review,
and it is the one this project already has.

**Markdown/MDX files in the repository.** Considered for the guides and advice
pages, where the content really is prose. Rejected for now because the guides
reference products and colours by id — a link that has to resolve, not a string
that has to be right. Front-matter plus typed references is where this would go
first, and it can be added without disturbing the structured data.

**A spreadsheet as the source of truth, imported at build time.** Tempting, and
the honest answer for dealer data specifically: 14 dealers, 6 unverified, gathered
by telephone. It stays a spreadsheet until it is confirmed, and becomes typed data
when it is. What it must never be is the thing the site reads directly, because
then there is no review step between a typo and a customer driving to the wrong
address.

## Consequences

**Good.**

- Content changes are versioned, attributed, reviewable and revertible — every
  property an audit of a published claim needs.
- The build fails when the content is wrong, which is the only form of content
  QA that runs every time.
- One edit updates the website, the colour index, the catalogue, the brochure, the
  fan deck and the specification sheets together.
- No vendor, no API key on the rendering path, no exit cost.

**Bad, and accepted.**

- **A non-developer cannot publish alone.** Every content change needs a pull
  request and a merge. That is the trade this ADR makes deliberately: the review
  is the control that stops an unverified claim reaching a customer. It is also
  the reason `docs/content-editing.md` exists and is written for somebody who has
  not opened a repository before.
- **Bulk edits are code edits.** Renaming a colour family touches every record
  that references it — which the type system finds, and a CMS would have found
  too, but slower and with a preview.
- **No draft/preview workflow for editors** beyond the deploy preview on a pull
  request, which requires a GitHub account.
- **Publishing means deploying.** A content fix ships with whatever else is on the
  branch. The mitigation is small branches and the fact that the site build takes
  under a minute.

## What would make us revisit this

- A content team that publishes weekly and must not wait for a developer. The
  first step is not a CMS: it is Markdown-with-typed-references for guides and
  advice, keeping structured product data in TypeScript. Only if that is not
  enough does a headless CMS become the answer — and then only for prose, never
  for the numbers the calculator uses.
- Data that changes on a schedule nobody controls (dealer stock, prices). Prices
  are not published at all today (ADR 0003); the day they are, they need an owner
  and a workflow, and probably a system.
- Multi-market or multi-language content, where the same fact has several approved
  wordings and a reviewer per market.
