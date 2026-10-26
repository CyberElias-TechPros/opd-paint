# Operations

How the enquiry pipeline behaves in production, what to watch, and what to do
when something goes wrong. Written for the person on call — which, for the
foreseeable future, is the same person who answers the phone.

The system is deliberately small: a static site, one Node process using only the
standard library, and append-only JSONL files. Everything below follows from
that. There is no queue, no database and no vendor SDK, and none of the recovery
procedures require a special tool.

---

## 1. Before launch: the six settings that decide whether leads reach a human

An enquiry is written to disk and answered with a reference number whether or
not any of this is configured. Without it, nobody is *told*. That is the failure
mode this section exists to prevent.

| Setting | Without it |
| --- | --- |
| `OPD_NOTIFY_WEBHOOK` **or** `OPD_RESEND_API_KEY` + `OPD_NOTIFY_EMAIL` + `OPD_NOTIFY_FROM` | No alert when an enquiry arrives. The lead waits in `/admin` for someone to look. |
| `OPD_ADMIN_USER` + `OPD_ADMIN_PASSWORD` | `/admin` answers 404. There is no way to read enquiries except the JSONL file. |
| `OPD_DATA_DIR` on a backed-up volume | A container restart takes the enquiries with it. |
| `OPD_SENTRY_DSN` (**optional**) | Errors are still written to `errors.jsonl`; nobody is paged. |
| `OPD_API_ORIGIN` (**Vercel only**) | The form on the Vercel deployment reports failure honestly and keeps the answers on the visitor's device. |
| A restore drill that has passed | The backup is a hypothesis. |

`GET /api/health` reports what is actually live, so this is checkable rather
than remembered:

```json
{
  "ok": true,
  "data": {
    "service": "opd-enquiries",
    "version": "a1b2c3d4e5f6",
    "uptime": 8201,
    "storage": "ready",
    "notifications": ["webhook", "email"],
    "inbox": true,
    "errorForwarding": true,
    "damagedRecords": 0
  }
}
```

---

## 1b. The gates that run on every push

Nine checks, and what to do when each one is red. A gate that nobody understands
gets disabled, so the failure mode is written down here.

| Check | Red means | First move |
| --- | --- | --- |
| **Site — lint, tests, routes, build** | lint error, a failed unit/content/server/browser test, or a route that no longer renders | the failing test names the behaviour; `npm run check` locally reproduces it |
| **Accessibility — axe** | an AA violation, a keyboard stop with no visible focus, a page that overflows 360px, or a console error | the PR comment lists the rule, the selector, and for contrast the resolved colours and ratio |
| **Lighthouse budgets** | LCP > 2.5 s, CLS > 0.1, TBT > 300 ms, a11y < 100, best practices or SEO < 95 | the PR comment lists every metric against its budget and, for CLS, the elements that moved |
| **Dependencies and secrets** | a high/critical advisory in a shipped dependency, or a credential-shaped string in the tree or history | rotate the credential and remove it; never add it to an allowlist |
| **Backups restore** | the drill failed — a restore that cannot verify, salvage or refuse correctly | run `bash tools/verify-restore.sh` locally; it uses throwaway data |
| **Brand assets are reproducible** | a generator's output no longer matches the committed file | re-run the generator, and check whether a library upgrade changed the bytes |
| **Vercel** | the build or the deployment failed | the config lives in `app/vercel.json` because the project's Root Directory is `app` |

Thresholds are arguments, not laws. If a budget is genuinely unreachable on the
hardware, change the number in `.lighthouserc.json` in its own commit, with the
reason in the message — do not delete the assertion.

---

## 2. When an enquiry arrives

```
POST /api/quotes
  → validate            (the server decides; the browser only advises)
  → honeypot check      (a filled `company` field gets a convincing 200 and is dropped)
  → append to quotes.jsonl
  → 201 with { reference, receivedAt, routedTo, slaHours }   ← visitor answered here
  → notify              (webhook and/or email, in the background)
```

The order matters. The visitor is answered **before** any notification is
attempted, so a slow or dead webhook can never make a submitted enquiry look
broken. Notification delivery:

- is retried twice in-process (0.5 s, then 2 s);
- writes one line per delivery to `notifications.jsonl` — channel, outcome,
  error, reference. Never the enquiry itself;
- logs `notify.delivered` with `ok: true|false`.

**Checking a channel without waiting for a real lead.** Point the webhook at a
throwaway listener and submit one enquiry:

```bash
# terminal 1 — print whatever arrives
python3 -c "from http.server import BaseHTTPRequestHandler,HTTPServer
class H(BaseHTTPRequestHandler):
    def do_POST(s):
        n=int(s.headers['Content-Length']);print(s.rfile.read(n).decode());s.send_response(200);s.end_headers()
HTTPServer(('127.0.0.1',9999),H).serve_forever()"

# terminal 2
OPD_NOTIFY_WEBHOOK=http://127.0.0.1:9999/hook OPD_DATA_DIR=/tmp/opd-test npm run server

# terminal 3
curl -sS -X POST http://127.0.0.1:8787/api/quotes \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Desk","phone":"08030000000","city":"Port Harcourt","projectType":"interior-room","consent":true}'
```

If `configuredChannels()` is empty, the service says so **at startup**:

```
WARN service.no_notification_channels  Enquiries will be stored and shown in /admin,
but nobody will be alerted. Set OPD_NOTIFY_WEBHOOK or OPD_RESEND_API_KEY + …
```

**A lead that was never delivered.** `notifications.jsonl` keeps the record:

```bash
jq -r 'select(.results[].ok == false) | .reference' server/data/notifications.jsonl
```

Then look the reference up and call the number. This is a manual recovery, not a
queue: an at-least-once retry queue belongs with the CRM integration
(roadmap 14.01) and is not built yet.

---

## 3. Errors

Two independent streams, both plain files:

| File | Written by | Contains |
| --- | --- | --- |
| `errors.jsonl` | `POST /api/errors` from the browser, and server-side faults | kind, message, capped stack, path, release, user agent, request id |
| `notifications.jsonl` | the notifier | delivery outcomes |
| `quotes.jsonl` / `subscriptions.jsonl` | the enquiry service | the enquiries themselves |

**There is no personal data in an error report, by construction.** The client
sends the path *without* its query string (a shared link can carry an email);
the server strips email addresses and long digit runs, refuses any `extra` key
called `email`, `phone`, `name`, `password` or `token`, and caps every field.
Two independent places would have to be wrong for a leak.

This is operational diagnostics, not analytics — so it is not gated on consent.
The privacy notice says exactly that.

With `OPD_SENTRY_DSN` set, the same event is forwarded to Sentry's store API
using `fetch`. No SDK in the browser bundle.

Reading the last day of browser faults:

```bash
jq -r 'select(.at > "2026-10-25") | "\(.at) \(.kind) \(.path) — \(.message)"' \
  server/data/errors.jsonl | tail -40
```

---

## 4. Logs

One JSON object per line when `OPD_LOG_FORMAT=json` (the default under
`NODE_ENV=production`), readable text otherwise. Every request carries an
`X-Request-Id` header and an `id` in its log line, so support can trace a
visitor's report to a record.

| Event | Meaning | Act when |
| --- | --- | --- |
| `http.request` | one line per non-asset request: status, duration | 5xx rate climbing |
| `enquiry.received` | a lead was stored, with reference and routing | — |
| `enquiry.storage_failed` | the append failed; the visitor was told to call | **immediately** |
| `notify.delivered` | per-channel delivery, `ok` true/false | `ok:false` means nobody knows about a lead |
| `notify.audit_failed` | `notifications.jsonl` could not be written | disk full or permissions |
| `client_error` | a browser reported a fault | a spike means a broken deploy |
| `storage.damaged_lines` | unparseable JSONL lines were skipped | investigate; the data is not lost, it is unreadable |
| `service.no_notification_channels` | startup, nobody will be alerted | configure a channel |

Useful one-liners:

```bash
# every stored lead today
jq -r 'select(.event == "enquiry.received") | .reference' api.log | sort | uniq -c

# request status histogram
jq -r 'select(.event == "http.request") | .status' api.log | sort | uniq -c

# slowest requests
jq -r 'select(.event == "http.request") | "\(.ms)\t\(.path)"' api.log | sort -rn | head
```

**Log lines never contain a name, phone number, email or message body.** If one
ever does, it is a bug in `server/index.mjs`, not a configuration option.

---

## 5. Monitoring: what to alert on

| Check | Threshold | Why |
| --- | --- | --- |
| `GET /api/health` returns 200 | 2 consecutive failures, 1 min apart | the only process there is |
| `data.damagedRecords > 0` | any | a write was cut short; the log needs repair |
| `data.storage != "ready"` | any | the data directory is missing — likely an unmounted volume |
| `data.notifications` is `[]` | any | no lead will ever be announced |
| log `enquiry.storage_failed` | any | enquiries are being refused |
| 5xx rate on `/api/*` | > 1% over 5 min | site can look fine while the form is dead |
| monthly restore drill | not run in 35 days | a backup nobody restored |

The monthly drill is not a metaphor: run `tools/verify-restore.sh` (it uses
throwaway data), and once a quarter restore a **real** archive into a scratch
directory and reconcile the record count against the archive.

---

## 6. Backups and restore

Backups: `tools/backup.sh DEST`, nightly from cron, 30-day retention, archives
created `0600` because they contain personal data. Store them off the host, and
encrypt them — the script deliberately does not pretend to solve that.

Restore: `tools/restore.sh ARCHIVE TARGET` — with more care than a `tar -xzf`:

1. the archive must be readable, and every member must be a plain relative path
   (a tar can carry `../../` members);
2. valid records are restored in order; **damaged lines are quarantined**, not
   dropped and not fatal — a disk that filled mid-append is the realistic
   incident, and refusing the archive would leave you with nothing;
3. an existing data directory is never overwritten without `--force`;
4. the result is reported as a count and a date range, so it can be reconciled.

The whole round trip — including the traversal case, the damaged-archive case
and a check that the restored data is served correctly by the service — runs on
every CI run as `tools/verify-restore.sh`. Restoring and not checking is how
people discover, six months later, that the cron job was silent.

**If a truncated line is found in a live log**, `/api/health` reports
`damagedRecords`. The good records are still served; the bad line is skipped and
logged. To repair by hand:

```bash
# keep the readable records, keep the damaged line for inspection
python3 - <<'PY'
import json, shutil
src = 'server/data/quotes.jsonl'
shutil.copy(src, src + '.bak')
good, bad = [], []
for line in open(src):
    if not line.strip():
        continue
    try:
        json.loads(line); good.append(line)
    except Exception:
        bad.append(line)
open(src, 'w').writelines(good)
open(src + '.damaged', 'w').writelines(bad)
print(f'{len(good)} kept, {len(bad)} quarantined')
PY
```

---

## 7. Incidents

**"A client says they submitted the form and heard nothing."** Search the log
for the reference they were given (it is on their confirmation screen). If
`enquiry.received` exists, the lead is in `quotes.jsonl` and the fault is
downstream: check `notifications.jsonl` for that reference. If there is no log
line at all, they did not submit successfully — check `client_error` and
`quote_failure` events around that timestamp.

**"The form is failing for everyone."** `curl -sS -X POST /api/quotes` with a
known-good body. 503 means storage; 429 means the rate limiter (12 per IP per
10 minutes — a whole office behind one NAT can hit it during a campaign, and the
answer is to raise the limit deliberately, not to disable it).

**"The site is fine but no leads arrive."** Compare `enquiry.received` counts
against the previous week. A drop to zero with a healthy service usually means
traffic, not the site — but check `/api/health` first, then the CDN.

**"A deploy broke a page."** `client_error` events name the release. Roll back
first, diagnose second; the release stamp is in every error report and on
`/api/health` as `version`.

**"The disk filled."** The service answers 503 and tells the visitor to call —
it does not lose the file or truncate it silently. Free space, then run the
repair script in §6, then check `damagedRecords` is zero.

---

## 8. What is deliberately not here

Named so that nobody assumes it exists:

- **No retry queue for notifications.** Two in-process retries, then a record.
- **No paging.** Monitoring is a cron job calling `/api/health` and a person
  reading a channel, not an on-call rota.
- **No CRM.** The JSONL is the system of record; `/admin/enquiries.csv` is the
  export path.
- **No analytics platform.** Page views are a consent-gated `dataLayer` push;
  nothing is sent to a third party until one is chosen.
- **No log shipping.** `OPD_LOG_FORMAT=json` makes it possible; configuring a
  drain is a deployment decision.
