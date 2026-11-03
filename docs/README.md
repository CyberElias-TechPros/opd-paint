# Documentation

The build itself is documented here. The 154-role / 23-phase roadmap lives in
the repository root `README.md` and is the source of what the platform is meant
to become; these files describe what exists today, how to run it, and what is
still a placeholder.

| File | Read it when |
| --- | --- |
| [running.md](running.md) | You want to run the site, the enquiry API, the tests or a production build. |
| [content-editing.md](content-editing.md) | You need to add a colour, product, guide, dealer or project — without touching React. |
| [qa-checklist.md](qa-checklist.md) | You are reviewing a release against the README's gates, or you need to know what is *not* real yet. |
| [brochure.md](brochure.md) | You are regenerating or editing the printed colour book, or briefing a printer. |
| [catalogue.md](catalogue.md) | You are regenerating the master catalogue — the colour book, room book, colour wheel, specification sheet, fan deck and every data sheet, bound into one file with a new chapter of restored site photography. |
| [deploying.md](deploying.md) | You are putting it on a server: Docker, systemd, nginx, env vars, backups, post-deploy smoke test. |
| [operations.md](operations.md) | You are on call: notifications, error reports, log events, what to alert on, the inbox access model, retention, data-subject requests, backup and restore, incident playbooks. |
| [launch-runbook.md](launch-runbook.md) | You are launching: who owns what, the service levels and recovery objectives, the pre-launch checklist, launch-day order, the first 72 hours, and the ongoing cadence. |
| [adr/](adr/README.md) | You want to know *why* it is built this way: the static-site-plus-one-service decision, typed data instead of a CMS, and no e-commerce at launch. |
| [remaining-work.md](remaining-work.md) | You are planning what is left: a gate-by-gate gap analysis against the root README roadmap, with the business blockers named. |
| [implementation-audit.md](implementation-audit.md) | You want to know what was checked against the docs, what was found wrong, what was fixed and how that is proven — and what is still wrong on purpose. |

## Layout

```
app/                    React 19 + Vite + Tailwind v4 front end
  public/               brand marks, media (WebP), generated PDFs, robots, sitemap
  scripts/              test runners and content tests (run by `npm test`)
  src/
    components/         UI kit, layout, room visualiser, calculator, colour cards,
                        search palette
      brand/            wordmark, brush sweep, guarantee seal, plank wall
    data/               colours, products, palettes, projects, dealers, guides, tools
    lib/                colour maths, quantity engine, advisor, share links, API
                        client, SEO, analytics
    routes/             one module per URL
    store/              saved project board, toasts, consent
server/                 Node http enquiry API (no framework, no database):
                        index, auth (roles, TOTP, sessions), limits (rate limiting
                        and dedupe), notify (delivery, health, acknowledgements),
                        errors, logger — plus one test file per module
deploy/                 nginx and systemd samples for a host without Docker
tools/                  media pipeline, PDF generation (TDS, SDS, guide, fan deck,
                        master catalogue), icons, sitemap, colour index, backups,
                        and the operational checks: uptime, production smoke test,
                        load test, rollback, erasure
opuda/                  the original photographs the media pipeline derives from
```

## Commands at a glance

```bash
cd app
npm install
npm run dev        # site on http://localhost:5173
npm run server     # enquiry API on http://localhost:8787
npm test           # calculator, wall-picker and compositor, content integrity,
                   # advisor and share-link tests
npm run test:server # enquiry API: validation, routing, auth, rate limits
npm run test:routes # 29 cases across 22 route modules render through the real router
npm run test:browser # quote form and calculator, driven in a DOM against the real service
npm run test:a11y  # axe + keyboard + reduced motion + 360px, in real Chromium
npm run check      # lint, all of the above, production build
```

Outside `app/` — the server suite and the operational tools:

```bash
node --test server/*.test.mjs                 # 112 checks across 7 files
node server/auth.mjs --new-secret "ada"       # generate a TOTP secret for the inbox
node tools/uptime-check.mjs --origin <origin> # 6 live probes, each asserting something
node tools/smoke-production.mjs --origin <origin> --release <sha> [--write]
node tools/load-test.mjs --origin <staging>   # never at production
./tools/rollback.sh --check                   # is there something to roll back to?
node tools/erase-record.mjs --email <address> # dry run; add --yes to apply
bash tools/verify-restore.sh                  # backup + restore drill, throwaway data
```

Backups are drilled, not assumed: `bash tools/verify-restore.sh` runs the real
`backup.sh` and `restore.sh` against throwaway data, including the damaged
archive a full disk produces, and checks the service serves what was restored.

Continuous integration runs exactly these steps, plus an accessibility job (axe
on Chromium, keyboard operability, reduced motion, 360 px layout), a Lighthouse
budget check, a backup/restore drill, a dependency and secret scan, and a job
that regenerates the
brand assets, documents, fan deck, master catalogue, social card and sitemap, then runs
`tools/check-assets.py` — so a design change cannot land without its artefacts.

A second workflow, `uptime.yml`, runs `tools/uptime-check.mjs` against
`OPD_SITE_ORIGIN` every fifteen minutes (or on demand), opens one issue when the
site fails and closes it when the site recovers. It stays skipped until that
repository variable is set, so a fresh fork is not littered with issues about a
domain it does not own.

That check compares PDFs, PNGs and XML byte for byte (their generators pin every
timestamp, so they are reproducible), and compares the social card's decoded
pixels instead, because a JPEG is the output of libjpeg-turbo and two builds of
it can encode identical artwork to different bytes. The tolerance is calibrated
in the script: it absorbs a re-encode and still fails on a recoloured chip. The
toolchain is pinned in the workflow, and a failure posts the file list on the
pull request rather than leaving a red cross with no explanation.
