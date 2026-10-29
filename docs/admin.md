# The content-admin layer

`/admin/content` is a small, honest answer to "can a non-developer change
things on the live site without filing a pull request". It is **not** a
headless CMS, and it does not try to be one — that decision, and what it does
instead, is worth spelling out.

## What it is

A single HTML page (`GET /admin/content`) backed by five JSON endpoints
(`GET /api/admin/content`, `POST /api/admin/content/{dealers,products,colours,guides}`),
served by the same dependency-free Node process as the enquiry inbox, behind
the same Basic Auth (`OPD_ADMIN_USER` / `OPD_ADMIN_PASSWORD`). It lets someone
without a development environment:

- mark a dealer verified, edit its hours/area/kind/services, add a new dealer,
  or remove one;
- flip a product's `claimsStatus` between `pending-verification` and
  `label-verified`, and toggle whether a pack size is in stock;
- record a `measuredLrv` once a colour has been read on a spectrophotometer
  (or clear it back to the hex-derived estimate);
- update a guide's `reviewer` and `updated` date after a review.

That list is not arbitrary — it is `docs/remaining-work.md`'s own list of
fields marked provisional (`verified: false`, `pending-verification`,
unmeasured LRV, guide review metadata). The admin layer exists to let the
business close those gaps as real information arrives, without having to
reopen the codebase for a fact that isn't a code change.

## What it deliberately is not

Everything else — colour hex values, product copy, coverage rates, guide body
text, page layout, the WhatsApp number, the brand voice — stays a code change,
reviewed like any other. A paint brand's published facts (a coverage rate, a
drying time, a guarantee term) are claims the business is legally and
reputationally answerable for; they belong in a reviewed diff with a named
author, not in a form a browser extension could resubmit. `docs/content-editing.md`
still documents that path, and remains the only path for anything not in the
list above.

## How it works

```
browser ──▶ /admin/content (HTML + fetch)
              │
              ▼
        /api/admin/content/*  (server/admin-content.mjs)
              │  reads server/content-base.json for ids/current values
              │  validates the request
              ▼
        server/content-store.mjs
              │
        ┌─────┴─────┐
        ▼           ▼
   fs backend   github backend
  (local disk)  (Contents API)
```

- **`server/content-base.json`** is a generated, committed snapshot of the
  ids and display fields the admin UI needs — the dealer list, product packs,
  colour hex/codes, guide titles. It is produced by
  `tools/export-content-snapshot.mjs`, which is wired into `npm run build`
  (`app/package.json`), and exists because `server/index.mjs` is plain Node
  with no TypeScript toolchain: it cannot `import` `app/src/data/*.ts`
  directly, the same reason `sitemap.xml` is generated rather than hand-written.
  It is a read model, never the source of truth — regenerating it never loses
  an edit, because edits live in the override files below.
- **`app/src/data/overrides/{dealers,products,colours,guides}.json`** hold the
  actual edits, in the smallest shape each content type needs (see
  `app/src/lib/contentOverrides.ts` for the exact merge rules). They ship with
  the app and are default-empty — a fresh checkout behaves exactly like the
  typed data files alone. Each data module (`dealers.ts`, `products.ts`,
  `colors.ts`, `guides.ts`) applies its override file at import time, so every
  page, the calculator, the search index and the content-integrity test suite
  (`app/scripts/data.test.ts`) all see the same effective data with no extra
  wiring.
- **`server/content-store.mjs`** is the only file that knows *where* an edit
  is written, and it has two backends:
  - **`fs` (default).** Writes the override JSON straight to disk. Correct
    wherever the filesystem is durable — a VM, a container with a volume, the
    same host the enquiry log already trusts. **Wrong for a stock serverless
    deployment**: a write can vanish the moment the function's container
    recycles, and it never reaches the static build Vercel actually serves,
    because the site is a pre-rendered bundle, not a server reading these
    files live. If you run the admin on a serverless host, use `github`
    instead, or run the admin's Node process somewhere with a disk (exactly
    where the enquiry inbox already needs to live).
  - **`github`.** Writes the same file through the GitHub Contents API, as a
    real commit, using Node 22's built-in `fetch` (no new dependency). A save
    becomes a normal commit to `app/src/data/overrides/*.json`, which triggers
    a normal deploy and therefore actually changes the published site. This
    is the backend that makes sense once a CI/CD pipeline — not this
    sandbox — is the one deploying.

Switch backends with `OPD_CMS_BACKEND=github` plus `OPD_CMS_GITHUB_TOKEN` (a
fine-grained PAT scoped to Contents: Read & write on this one repository) and
`OPD_CMS_GITHUB_REPO` (`owner/name`); `OPD_CMS_GITHUB_BRANCH` defaults to
`main`. Without both the token and the repo set, the service always falls back
to `fs`, even if `OPD_CMS_BACKEND=github` is set — a half-configured backend
should behave like the safe default, not fail silently on the first save.

## Validation

The server, not the browser, is the one that can be trusted, so every write is
checked there:

- a new or edited dealer's coordinates must fall inside Nigeria's bounding box
  (the same `lat > 3.8 && lat < 13.9`, `lng > 2.6 && lng < 14.7` the
  content-integrity test enforces on the typed data);
- a dealer id must be lowercase and hyphenated, and unique against the current
  effective list (base data plus prior overrides);
- a product's `claimsStatus` must be `label-verified` or
  `pending-verification`; pack-stock keys must match that product's actual
  declared pack sizes — you cannot invent a pack size from the admin page;
- a colour's `measuredLrv` must be a number from 0 to 100, or `null` to clear
  it back to the estimate;
- a guide's `updated` date must look like `YYYY-MM-DD`, and `reviewer` must be
  non-empty.

A rejected request returns `422` with a `fields` object naming what failed, so
the page can point at the exact input rather than a generic error.

## Honest limits

- This is edit-in-place for a short list of fields, not a general content
  model. Adding a new editable field means a small, reviewable change to
  `contentOverrides.ts`, `admin-content.mjs` and the admin page — by design,
  so the list of what a browser can change never grows silently.
- The `fs` backend's data does not survive a serverless redeploy. Use
  `github`, or run the admin server on a host with a persistent disk, before
  relying on it in production.
- The `github` backend commits directly to the configured branch with no
  review step. That is appropriate for the fields above (operational facts,
  not editorial claims); it would not be appropriate if the scope ever grew to
  include product copy or guide text.
- There is no draft/publish distinction and no revision history beyond
  whatever the backend already gives you (git history, for `github`).

## Testing it locally

```bash
cd app
npm run build   # regenerates server/content-base.json
cd ../server
OPD_ADMIN_USER=opudas OPD_ADMIN_PASSWORD=dev-only node index.mjs
# then: http://localhost:8787/admin/content (Basic Auth: opudas / dev-only)
```

`server/admin-content.test.mjs` exercises the full HTTP surface — auth
gating, every content type's happy path, and the validation rejections above
— against a disposable snapshot and override directory, so it never touches
the real committed files. Run it with the rest of the server suite:
`cd app && npm run test:server`.
