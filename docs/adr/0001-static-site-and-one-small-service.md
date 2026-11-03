# ADR 0001 — A prerendered static site, and one small Node service behind it

- **Status:** accepted
- **Date:** 2026-11-03
- **Answers:** roadmap 07.01.01–07.01.08 (evaluate and approve an architecture), 07.02.01–07.02.06 (system design), 22.03 (deliver architecture and deployment documentation)
- **Supersedes:** nothing. **Superseded by:** nothing.

## Context

OPUDA'S PAINT is a paint manufacturer in Port Harcourt selling through a dealer
network. The website's job, in order of value:

1. let a customer find a colour and believe what they see on screen,
2. let them work out how much paint a job needs,
3. get an enquiry to a human being who can quote it,
4. be found by search engines for the things it can genuinely answer.

What it is *not* asked to do at launch is take payment, hold stock, run customer
accounts, or personalise anything (see ADR 0003). The people who will maintain it
are a small internal team plus whoever they hire next; there is no operations
function, no on-call rota and no platform team. Recurring cost matters, and so
does the question "can somebody who did not build this fix it at 7pm on a
Saturday?"

Constraints that shaped the decision:

- Enquiries are personal data under the NDPA, so wherever they land has to be
  backed up, access-controlled, retention-limited and deletable on request.
- Colour is the product. A page that renders a colour wrongly, slowly, or only
  after a network round trip is worse than no page.
- Connectivity in the launch market is variable. The site has to work on a
  mid-range Android phone on a congested network, and degrade usefully when the
  backend is unreachable.
- The budget for infrastructure at launch is closer to zero than to a platform
  team's.

## Decision

**A Vite/React site, prerendered to static HTML at build time, served by a CDN or
nginx — with exactly one small Node service behind it for the four things that
need a server.**

The service (`server/index.mjs`, ~1,500 lines, standard library only, no
framework, no dependencies) owns:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/quotes` | accept an enquiry, validate it, route it to a desk, store it, announce it |
| `POST /api/subscribe`, `POST /api/unsubscribe` | newsletter consent, and its withdrawal |
| `POST /api/errors` | browser fault reports, scrubbed before storage |
| `GET /api/search/colours` | colour search over a generated index |
| `GET /api/health` | capability, never configuration |
| `GET /admin`, `GET /admin/enquiries.csv` | the enquiry inbox, behind credentials, a second factor, roles, an allowlist and an access log |

Storage is **append-only JSON lines** in one directory (`quotes.jsonl`,
`subscriptions.jsonl`, `unsubscriptions.jsonl`, `notifications.jsonl`,
`errors.jsonl`, `admin-access.jsonl`, `privacy-requests.jsonl`, `limits.jsonl`,
`erasure-log.jsonl`). There is no database.

The site is deployed independently of the service: the bundle to a CDN or
`OPD_STATIC_DIR`, the service to one container or one systemd unit. Either can be
rolled back without the other (`tools/rollback.sh`).

## Options considered

**A conventional CMS (WordPress, Drupal).** Rejected. The content that matters —
59 colours with hex values, LRV, family and finish; 6 products with coverage
rates; 19 project guides — is structured data that drives calculations, not prose
in a rich-text field. A CMS would put a text editor between the data and the
calculator that consumes it, and every plugin is a supply-chain and patching
obligation for a team with no operations function. It also answers none of the
enquiry problem, which is the reason a server exists at all.

**A headless CMS (Contentful, Sanity, Strapi).** Rejected, more reluctantly — the
modelling would have been fine. But it adds a paid vendor, an API dependency on
the critical rendering path, a second place where content can be wrong, and an
exit cost, in exchange for editing convenience that this project does not need
yet: content changes are rare, reviewable and already possible in TypeScript with
tests (ADR 0002). `tools/build-*.py` generates the printed collateral from the
same source, which a headless CMS would not do.

**A commerce platform (Shopify, WooCommerce).** Rejected. There is nothing to
sell online at launch (ADR 0003), and the platform would dictate the colour
experience, which is the one part of this site that has to be exactly right.

**A full-stack framework with a database (Next.js + Postgres, Rails, Laravel).**
Rejected on proportionality. A database is the right answer when records are
queried in more than one dimension, updated in place, or transacted against. An
enquiry is written once, read newest-first, exported to CSV, and eventually
deleted by age or by request — which is what an append-only file does natively,
with `tar` as the backup tool and `grep` as the query language. Adding Postgres
adds a server to patch, a connection to lose, a migration to run and a dump to
test, and buys nothing at this volume.

**No backend at all (a form service such as Formspree).** Rejected. It would have
removed the only place personal data is controlled: retention, erasure, access
logging, rate limiting, dedupe and routing are all obligations this project has
taken on, and none of them can be discharged by forwarding a form to a third
party's inbox.

## Consequences

**Good.**

- No runtime dependencies in the service, so no dependency patching on the
  component that holds personal data; `npm audit` has nothing to say about it.
- Cold start is a process launch. Deploy is copying files. Rollback is copying
  older files (`tools/rollback.sh --snapshot` before each deploy).
- The whole system fits in one head: a static bundle, one process, one directory.
- Failure modes are visible and testable. 112 server tests run against the real
  service in CI without a database, a container or a network.
- Cost at launch is one small host plus a CDN.

**Bad, and accepted.**

- **No queries.** "Every enquiry from Lagos in March that mentioned damp" is a
  `grep`, not an index. At the volumes that matter here (tens per day) that is
  fine; it stops being fine at thousands per day, which is a good problem and has
  a known answer (see below).
- **No concurrency control.** Two processes appending to the same file is safe on
  POSIX for line-sized writes, and the limiter store is built to tolerate a
  second reader — but there are no transactions, and a crash mid-append leaves a
  damaged line. The service skips and logs damaged lines rather than failing, and
  `tools/erase-record.mjs` refuses to delete a line it cannot parse.
- **No horizontal scale for limits.** The rate limiter shares state through the
  file, which means one writable volume; two instances on two hosts need
  `OPD_RATE_STORE=memory` (per-instance limits) or a real store.
- **Backup is a file copy**, so it is only as good as its schedule. `tools/backup.sh`,
  `tools/restore.sh` and `tools/verify-restore.sh` exist because a backup nobody
  has restored is a rumour.
- **Admin is a server-rendered page**, not an app. It lists, filters by desk and
  exports. Anything richer means writing HTML in a template string, which is why
  it has stayed small.

## What would make us revisit this

Any one of these is a reason to introduce a database and a real API layer, and
none of them is a reason to be embarrassed about the current design:

- enquiry volume where the inbox needs search, assignment, notes and status
  (a lead pipeline rather than a log),
- e-commerce (ADR 0003 reversal), which needs transactions and stock,
- more than one host serving the API, which needs shared rate-limit and session
  state,
- a content team that must publish without a pull request (ADR 0002 reversal).

The migration path is deliberate and cheap to start: the JSON lines files *are*
the export format. A first migration is a script that reads them and inserts into
Postgres, with the service's `readRecords()` swapped for a query. Nothing in the
site's bundle changes, because the site never knew.
