# Deploying OPUDA'S PAINT

The site is a static build plus one small Node service. There is no database, no
framework runtime and no third-party dependency in production — the enquiry
service uses only the Node standard library, so it starts in milliseconds and has
nothing to patch.

```
app/dist/            the built site; one index.html per route carries that page's head
server/index.mjs     the enquiry service: /api/*, /admin, and optionally the site
server/data/*.jsonl  the enquiry log — the only thing that must be backed up
```

## What the service does

| Route | Purpose |
| --- | --- |
| `POST /api/quotes` | Trade quote, sample request or dealer enquiry. Validates, honeypots, rate-limits, appends to `quotes.jsonl`. |
| `POST /api/subscribe` | Colour-newsletter opt-in, appended to `subscribers.jsonl`. |
| `GET /api/search/colours?q=` | Colour-code and name lookup used by the site search. |
| `GET /api/health` | Liveness for Docker, systemd or an uptime monitor. |
| `GET /admin` | Read-only enquiry inbox. **404 unless credentials are configured.** |
| `GET /admin/enquiries.csv` | The same records as CSV, for a spreadsheet or a CRM import. |

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8787` | The service binds `0.0.0.0`. |
| `OPD_DATA_DIR` | `server/data` | Where the `.jsonl` logs live. Point this at a volume. |
| `OPD_STATIC_DIR` | unset | Set it and the service also serves the built site, including the client-side routes and the security headers. |
| `OPD_ADMIN_USER` | unset | Enables the inbox. |
| `OPD_ADMIN_PASSWORD` | unset | Enables the inbox. Use a long random string — it is compared in constant time, not hashed on disk, so treat it like a password for a bank account. |
| `OPD_NOTIFY_WEBHOOK` | unset | Any JSON-POST endpoint — Slack, Teams, Zapier, Make. Without it (or email) enquiries arrive silently; the service warns at startup. |
| `OPD_RESEND_API_KEY`, `OPD_NOTIFY_EMAIL`, `OPD_NOTIFY_FROM` | unset | Transactional email via Resend. All three are needed for email to be attempted. |
| `OPD_SENTRY_DSN` | unset | Forwards browser and server errors to Sentry using `fetch`. Optional: errors are written to `errors.jsonl` either way. |
| `OPD_LOG_FORMAT` | `json` when `NODE_ENV=production` | One JSON object per line, ready for any drain. |
| `OPD_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. |
| `OPD_RELEASE` | unset | Name attached to error reports; Vercel supplies the commit SHA automatically. |
| `OPD_API_ORIGIN` | unset | Vercel only: where `app/api/[...path].js` forwards `/api/*`. |

The behaviour behind these — what is written where, what to alert on, what to do
when a lead was never announced — is in [operations.md](operations.md). The
short version: **configure a notification channel before launch.** An enquiry
that is stored but never announced is a lead lost politely.

If either admin variable is missing, `/admin` returns **404**, not 401. An
unconfigured inbox is invisible rather than merely locked, which is the safer
default on a public host.

## Option A — Docker Compose (recommended)

```bash
cp .env.example .env          # then edit the two admin values
docker compose up -d --build
curl -fsS http://127.0.0.1:8787/api/health
```

The image is two stages: Node builds the site, then a fresh Alpine stage copies
in `dist`, `server/` and the manifest. The runtime holds no build tooling, runs as
the unprivileged `node` user, and writes to one volume, `enquiries`.

Enquiries survive `docker compose down`; they are deleted by `down -v`, so take
backups (below) before you ever run that.

## Option B — systemd + nginx

```bash
sudo useradd --system --home /srv/opudas opudas
sudo rsync -a --exclude node_modules ./ /srv/opudas/
cd /srv/opudas/app && npm ci && npm run build

sudo cp deploy/opudas.service /etc/systemd/system/
sudo install -m 600 /dev/null /etc/opudas.env
sudo tee /etc/opudas.env >/dev/null <<'EOF'
OPD_ADMIN_USER=opudas
OPD_ADMIN_PASSWORD=replace-with-a-long-random-string
EOF
sudo systemctl enable --now opudas
```

Then put `deploy/nginx.conf` in `/etc/nginx/sites-available/`, point it at
`/srv/opudas/app/dist`, and get a certificate:

```bash
sudo certbot --nginx -d opudapaint.com -d www.opudapaint.com
```

nginx owns TLS, compression and caching; the service is reached only over
`127.0.0.1`. `client_max_body_size 256k` in the sample matches the service's own
32 KB enquiry limit with room for headers, so an oversized body is rejected with
a readable 413 instead of a truncated socket.

If you would rather have one process and no nginx, run the service with
`OPD_STATIC_DIR=/srv/opudas/app/dist` and let it serve everything. It already
sets HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
and `Permissions-Policy`, caches hashed assets for a year and HTML not at all.

## Option C — Vercel for the site, a container for the service

Vercel can host the *site*. It cannot host the *service*, and the reason is
worth stating: a serverless function has no durable filesystem, and the enquiry
log is the one thing in this project that must survive. So the two are deployed
separately, with one seam between them:

```
browser ──▶ Vercel (static build + /api/* proxy) ──▶ the enquiry service
```

**On Vercel:** the project's **Root Directory is `app`**. That is where
`app/vercel.json` and `app/api/[...path].js` are read from — the platform does
not look at the repository root for either. The config sets the build
(`npm run build`), the output (`dist`), the security headers, immutable caching
for hashed assets, and a revalidating policy for HTML and `sw.js`.

Two environment variables are required in the Vercel project:

| Variable | Value |
| --- | --- |
| `OPD_API_ORIGIN` | Where the enquiry service is reachable, e.g. `https://api.opudapaint.com`. No trailing slash needed. |
| `VERCEL_GIT_COMMIT_SHA` | Provided by Vercel automatically; the build turns it into the release stamp that appears in error reports. |

With `OPD_API_ORIGIN` unset the proxy answers `503` with a readable body and the
form keeps the visitor's answers on their device and offers the phone number —
a preview without a backend must not pretend to accept enquiries.

Check it after deploying:

```bash
curl -sS https://<deployment>/api/health | jq
```

A `502` there means the proxy is fine and the origin is unreachable; a `503`
means the variable is missing.

## Backups

```bash
OPD_DATA_DIR=/srv/opudas/data ./tools/backup.sh /var/backups/opudas
```

The script writes a 0600 tarball, prints the enquiry count and rotates archives
older than 30 days (`OPD_BACKUP_DAYS`). Run it nightly:

```cron
15 2 * * * OPD_DATA_DIR=/srv/opudas/data /srv/opudas/tools/backup.sh /var/backups/opudas
```

The archive contains names, phone numbers and site addresses. It is personal
data: store it encrypted and off the host (an object store with server-side
encryption is enough), and delete it on the same schedule you promise in
`/legal/privacy`.

### Restoring

```bash
./tools/restore.sh /var/backups/opudas/opudas-enquiries-20261026T021500Z.tar.gz /srv/opudas/data
```

It verifies the archive is readable and contains no traversal paths, restores
records in order, quarantines any damaged line into a `.damaged-<stamp>` sidecar
rather than refusing the archive or dropping data, refuses to overwrite a live
directory without `--force`, and prints the record count and the date range so
the restore can be reconciled against the archive.

### Proving it works

```bash
bash tools/verify-restore.sh
```

Runs the real backup and restore against throwaway data — including a truncated
final line, a non-archive, an archive with `../../` members, and a check that the
service serves exactly the restored records. It runs in CI on every push. Do it
quarterly against a real archive too: restore into a scratch directory and
reconcile the count. A backup nobody has restored is a hypothesis.

### After a deploy

```bash
curl -fsS https://opudapaint.com/api/health | jq
```

Expect `storage: "ready"`, `notifications` to list the channels you configured,
`inbox: true`, and `damagedRecords: 0`. Then submit one real enquiry from a
phone, confirm it arrives in the channel, and delete it from `quotes.jsonl`
afterwards if you do not want it in the log.

Every record carries a `receivedAt`, so pruning is a filter rather than a
schema change:

```bash
# Drop records older than two years, keeping a copy first.
./tools/backup.sh /var/backups/opudas
grep '"receivedAt":"20(2[0-3]|24)-' server/data/quotes.jsonl > /tmp/old.jsonl || true
```

## Cache and service worker

The build registers `/sw.js` in production. It is network-first for pages, so a
deploy is visible on the next navigation; photography, fonts and PDFs are
stale-while-revalidate. If you replace a photo in place without changing its
name, bump `CACHE_VERSION` in `app/public/sw.js` so returning visitors pick it up.

The service worker deliberately ignores `/api/` and `/admin`, so no enquiry,
credential or inbox page is ever written to a cache.

## Smoke test after every deploy

```bash
BASE=https://opudapaint.com
for path in / /colours /colours/opuda-white /products /products/matt /calculator /quote /dealers \
            /sitemap.xml /robots.txt /documents/opudas-matt-tds.pdf /media/og-card.jpg /sw.js; do
  printf '%-42s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")"
done
curl -fsS "$BASE/api/health"
curl -s -o /dev/null -w 'admin (expect 401 or 404): %{http_code}\n' "$BASE/admin"
```

Expect 200 everywhere, 401 (or 404 if you left the inbox unconfigured) at
`/admin`, and `{"ok":true,...}` from health.

## Monitoring

- **Uptime**: poll `GET /api/health` every minute; alert after two failures.
- **Enquiries**: `wc -l server/data/quotes.jsonl` should grow in business hours.
  A flat line for a working week usually means a form or a route is broken.
- **Disk**: the log is append-only text; 10,000 enquiries is roughly 4 MB. Watch
  it anyway, because a full disk loses enquiries silently.
- **Rate limiting** is in-process and resets on restart. One instance is the
  intended deployment; if you ever run two, move the limiter to a shared store
  first.

## Analytics and consent

The site emits events to `window.dataLayer` when a tag manager is present and
does nothing otherwise — there is no bundled tracker, no cookie set by us, and
no third-party script in the build. Add your tag manager in exactly one place
(`app/index.html`) and the existing events will flow into it.
