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
| [deploying.md](deploying.md) | You are putting it on a server: Docker, systemd, nginx, env vars, backups, monitoring, post-deploy smoke test. |

## Layout

```
app/                    React 19 + Vite + Tailwind v4 front end
  public/               brand marks, media (WebP), generated PDFs, robots, sitemap
  scripts/              test runners and content tests (run by `npm test`)
  src/
    components/         UI kit, layout, room visualiser, calculator, colour cards
      brand/            wordmark, brush sweep, guarantee seal, plank wall
    data/               colours, products, palettes, projects, dealers, guides
    lib/                colour maths, quantity engine, API client, SEO, analytics
    routes/             one module per URL
    store/              saved project board, toasts, consent
server/                 Node http enquiry API (no framework, no database)
deploy/                 nginx and systemd samples for a host without Docker
tools/                  media pipeline, PDF generation (TDS, SDS, guide, fan deck), icons, sitemap, backups
opuda/                  the original photographs the media pipeline derives from
```

## Commands at a glance

```bash
cd app
npm install
npm run dev        # site on http://localhost:5173
npm run server     # enquiry API on http://localhost:8787
npm test           # calculator, colour-mask and content integrity tests
npm run test:server # enquiry API: validation, routing, auth, rate limits
npm run test:routes # every one of the 21 routes renders through the real router
npm run check      # lint, all of the above, production build
```

Continuous integration runs exactly these steps, plus a job that regenerates the
brand assets, documents, fan deck, social card and sitemap and fails if the
committed files differ — so a design change cannot land without its artefacts.
