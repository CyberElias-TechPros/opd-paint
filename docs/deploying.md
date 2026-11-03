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
| `GET /api/health` | Liveness for Docker, systemd or an uptime monitor. Reports capability only — no counters a stranger could read. |
| `POST /api/privacy` | Data-subject requests (access, erasure, correction, objection, portability), each with a reference and a 30-day deadline. |
| `GET /admin` | Read-only enquiry inbox. **404 unless credentials are configured**; behind a second factor when one is. |
| `POST /admin/second-factor` | The TOTP step. Rate limited, and every attempt is written to `admin-access.jsonl`. |
| `GET /admin/enquiries.csv` | The same records as CSV, for a spreadsheet or a CRM import. Exporters only. |
| `POST /admin/sign-out` | Clears the session cookie. |

## Environment variables

Two of these decide whether the service behaves correctly *in a deployment*
rather than on a laptop, and both are easy to miss:

- **`OPD_TRUST_PROXY`** — behind nginx or Docker networking every request arrives
  from the gateway address, so an in-memory rate limit keyed on the socket locks
  out a whole city after twelve enquiries in ten minutes. Set it to the number of
  proxies you run. `deploy/nginx.conf` overwrites `X-Forwarded-For` with
  `$remote_addr` rather than appending to it, so a visitor cannot invent the
  address the limiter sees; the service also counts hops from the right, which
  keeps that true even on a config that appends.
- **`OPD_ALLOWED_ORIGIN`** — a cross-origin response without
  `Access-Control-Allow-Origin` is discarded by the browser, so an enquiry can
  succeed on disk and still look broken on screen. One exact origin, no
  wildcard, and the header is sent on every status including 422 and 429.



| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8787` | The service binds `0.0.0.0`. |
| `OPD_DATA_DIR` | `server/data` | Where the `.jsonl` logs live. Point this at a volume. |
| `OPD_STATIC_DIR` | unset | Set it and the service also serves the built site, including the client-side routes and the security headers. |
| `OPD_ADMIN_USER`, `OPD_ADMIN_PASSWORD` | unset | The single-account form of the inbox. Use a long random string — it is compared in constant time, not hashed on disk, so treat it like a password for a bank account. |
| `OPD_ADMIN_USERS` | unset | The multi-account form, and the one to prefer: JSON array of `{ user, password, role }`. Overrides the two above. |
| `OPD_ADMIN_ROLE` | `exporter` | Role for the single-account form: `viewer` reads the inbox, `exporter` may also download the CSV. |
| `OPD_ADMIN_TOTP_SECRET` | unset | Second factor for the single-account form. Generate with `node server/auth.mjs --new-secret "ada"`. Without it the customer log opens on a password alone. |
| `OPD_SESSION_SECRET` | falls back to `OPD_ADMIN_PASSWORD` | Signs the session cookie. Set it: the fallback means every password change signs the desk out, and a shared secret must not also be a credential. |
| `OPD_ADMIN_SESSION_TTL` | `3600` | How long one sign-in lasts, in seconds. |
| `OPD_ADMIN_ALLOW_CIDR` | unset | Comma-separated CIDRs (IPv4 or IPv6) allowed to reach `/admin`. Anything else gets 404. |
| `OPD_ADMIN_COOKIE_SECURE` | unset | Set to `1` behind TLS, which is every real deployment. |
| `OPD_NOTIFY_WEBHOOK` | unset | Any JSON-POST endpoint — Slack, Teams, Zapier, Make. Without it (or email) enquiries arrive silently; the service warns at startup. |
| `OPD_RESEND_API_KEY`, `OPD_NOTIFY_EMAIL`, `OPD_NOTIFY_FROM` | unset | Transactional email via Resend. All three are needed for email to be attempted. |
| `OPD_SENTRY_DSN` | unset | Forwards browser and server errors to Sentry using `fetch`. Optional: errors are written to `errors.jsonl` either way. |
| `OPD_LOG_FORMAT` | `json` when `NODE_ENV=production` | One JSON object per line, ready for any drain. |
| `OPD_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. |
| `OPD_RELEASE` | unset | Name attached to error reports; Vercel supplies the commit SHA automatically. |
| `OPD_API_ORIGIN` | unset | Vercel only: where `app/api/[...path].js` forwards `/api/*`. |
| `OPD_ALLOWED_ORIGIN` | unset | The one origin allowed to call `/api/*` from a browser. Set it only when site and service are on different origins; unset means same-origin only. Never `*` — enquiry bodies carry names and phone numbers. |
| `OPD_TRUST_PROXY` | unset | How many proxy hops to believe: `true`/`1` for one reverse proxy or Docker network, `2` for a CDN in front of that. Rate limits and the abuse log then key on the visitor instead of the gateway. Entries are counted from the right of `X-Forwarded-For`; leave unset on a port exposed directly to the internet. |
| `OPD_COLOUR_INDEX` | `server/colour-index.json` | Where the service reads the colour index it searches. Generated at build time; override only to point at another copy. |
| `OPD_RATE_STORE` | `file` when a data dir exists | `memory` switches limits back to per-process. Only do that for a scratch or load test, never in production. |
| `OPD_DEDUPE_MINUTES` | `10` | How long an identical enquiry is suppressed, returning the first reference with `duplicate: true`. |
| `OPD_NOTIFY_RETRY_MS` | `500` | Delay before the first notification retry; the second waits four times as long. |
| `OPD_NOTIFY_DOWN_AFTER` | `3` | Consecutive failures after which `notify.channel_down` is logged — the line to alert on. |
| `OPD_ACK_CUSTOMER` | `on` | `off` stops the acknowledgement email. It never stops the enquiry being stored. |
| `OPD_RESEND_URL` | `https://api.resend.com/emails` | Point it at a mock for local tests. |
| `OPD_RETENTION_DAYS` | `30` | Days to keep operational logs: notifications, errors, admin access. |
| `OPD_ENQUIRY_RETENTION_DAYS` | `730` | Days to keep enquiries and data-subject requests. **Must match the privacy notice.** |
| `OPD_SITE_ORIGIN` | unset | Canonical origin for the scheduled uptime check; unset means the workflow skips. |
| `OPD_UPTIME_HEARTBEAT` | unset | Dead-man's-switch URL. Pinged only when every check passed, so a monitor that stops running is itself an alert. |

The behaviour behind these — what is written where, what to alert on, what to do
when a lead was never announced — is in [operations.md](operations.md). The
short version: **configure a notification channel before launch.** An enquiry
that is stored but never announced is a lead lost politely.

If no credentials are configured, `/admin` returns **404**, not 401. An
unconfigured inbox is invisible rather than merely locked, which is the safer
default on a public host. The same answer is given to a caller from outside the
allowlist and for any path under `/admin` that does not exist, so 404 is never
evidence that the inbox is there. The full access model — roles, the second
factor, what is written to the access log, and how to re-enrol a lost phone — is
[operations.md §1a](operations.md#1a-the-inbox-who-gets-in-as-what-and-what-is-written-down).

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

### Before a deploy

```bash
./tools/rollback.sh --snapshot
```

You cannot roll back to something you did not keep. `--snapshot` tags the running
Docker image (or archives the current release, excluding `data/`, which must
survive) and keeps eight. `./tools/rollback.sh` then returns to it and waits for
health, and `--check` answers the question without changing anything.

### After a deploy

```bash
curl -fsS https://opudapaint.com/api/health | jq
node tools/smoke-production.mjs --origin https://opudapaint.com --release "$OPD_RELEASE"
```

From health, expect `storage: "ready"`, `notifications` to list the channels you
configured, `admin.mfa: true`, `limits.store: "file"`, `inbox: true`,
`damagedRecords: 0`, and a `retention` block that matches the privacy notice.

The smoke test is the real check and it is worth running from a laptop on a phone
connection rather than from the host: it fails when the release answering is not
the release you shipped, when a page serves a shell with no bundle behind it, when
the API contract changed shape, or when `/admin` and the CSV export are reachable
without credentials. Add `--write` to submit one genuine enquiry and follow it end
to end — the reference on screen, the acknowledgement email, the desk's channel,
the record in `/admin` — then remove it:

```bash
node tools/erase-record.mjs --reference OPD-261103-4K2P --yes
```

Do not hand-edit `quotes.jsonl`. The tool removes the record, adds a suppression
entry where one applies, keeps a line it cannot parse, and writes an audit line
with references only.

Retention is automatic (startup, then daily): 30 days for operational logs and 24
months for enquiries and data-subject requests, set by `OPD_RETENTION_DAYS` and
`OPD_ENQUIRY_RETENTION_DAYS`. Pruning is atomic, keeps undated lines rather than
guessing, and logs what it dropped. If you need a record kept longer for a live
enquiry, take a backup — do not raise the retention setting, which would quietly
change what the privacy notice promises.

## Cache and service worker

The build registers `/sw.js` in production. It is network-first for pages, so a
deploy is visible on the next navigation; photography, fonts and PDFs are
stale-while-revalidate. If you replace a photo in place without changing its
name, bump `CACHE_VERSION` in `app/public/sw.js` so returning visitors pick it up.

The service worker deliberately ignores `/api/` and `/admin`, so no enquiry,
credential or inbox page is ever written to a cache.

## Smoke test after every deploy

`node tools/smoke-production.mjs --origin <origin> [--release <stamp>] [--write]`
is the real one (21 checks, grouped into deployed / pages / contract / closed /
headers / writes; exit code 0 or 1, so it works in a pipeline). The loop below is
the ten-second version for when you are already in a terminal on the host:

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

- **Uptime**: `node tools/uptime-check.mjs --origin https://opudapaint.com` from
  cron every 5–15 minutes, or let `.github/workflows/uptime.yml` do it (set the
  `OPD_SITE_ORIGIN` repository variable). It opens a ticket on failure and closes
  it when the site recovers. Add `OPD_UPTIME_HEARTBEAT` so that a monitor which
  *stops running* is itself an alert — that is what makes this a monitor rather
  than a habit.
- **Delivery**: `/api/health` → `notificationHealth` counts consecutive failures
  per channel, and `notify.channel_down` is logged at three. Alerts only tell you
  something broke; this tells you *which* channel stopped working and when it last
  succeeded.
- **Enquiries**: `wc -l server/data/quotes.jsonl` should grow in business hours.
  A flat line for a working week usually means a form or a route is broken.
- **Disk**: the log is append-only text; 10,000 enquiries is roughly 4 MB. Watch
  it anyway, because a full disk loses enquiries silently.
- **Rate limiting** is backed by `limits.jsonl` inside the data directory, so it
  survives a restart and a redeploy. One instance is still the intended
  deployment: if you ever run two, they share the file only if they share the
  volume, and `OPD_RATE_STORE=memory` (or a read-only volume) quietly gives each
  instance its own allowance — which `/api/health` reports as `limits.store`.

What to alert on, and the incident responses that go with each symptom, is
[operations.md §5](operations.md). Launch day and the two weeks after it are
[launch-runbook.md](launch-runbook.md).

## Staging

Roadmap 17.01: a staging environment that is production-shaped, so that "it works
on my machine" and "it works in production" stop being different claims.

The cheapest shape that is still honest — same Docker image, same nginx config,
its own data volume, its own credentials, no real notification channel:

```bash
OPD_NOTIFY_WEBHOOK=https://hooks.example/staging \
OPD_DATA_DIR=/srv/opudas-staging/data \
OPD_ADMIN_USERS='[{"user":"staging","password":"<long random>","role":"viewer"}]' \
OPD_ADMIN_TOTP_SECRET=<staging secret> \
OPD_SESSION_SECRET=<staging session secret> \
docker compose -f docker-compose.yml -p opudas-staging up -d
```

`OPD_SITE_ORIGIN` is read by the *tools*, not by the service, so point the checks
at staging with `--origin https://staging.opudapaint.com` (or export it on the
machine that runs them) rather than inside the container.

Three rules make it worth having:

1. **The image is the same one production will run.** Staging that builds
   differently tests nothing.
2. **Staging gets no real customer channel.** Point the webhook at a throwaway
   listener and leave `OPD_RESEND_API_KEY` unset, or the desk and real customers
   receive test enquiries.
3. **The checks that matter run against it**: `smoke-production.mjs`,
   `load-test.mjs` (never against production), and the restore drill.

A staging environment with a copy of production data is a second place to leak
personal data. Keep it empty, or seed it with fixtures:
`OPD_DATA_DIR` pointing at a scratch directory and one submission from
`smoke-production.mjs --write` is enough to exercise the whole path.

## Analytics and consent

The site emits events to `window.dataLayer` when a tag manager is present and
does nothing otherwise — there is no bundled tracker, no cookie set by us, and
no third-party script in the build. Add your tag manager in exactly one place
(`app/index.html`) and the existing events will flow into it.
