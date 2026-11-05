# Operations

How the enquiry pipeline behaves in production, what to watch, and what to do
when something goes wrong. Written for the person on call — which, for the
foreseeable future, is the same person who answers the phone.

The system is deliberately small: a static site, one Node process using only the
standard library, and append-only JSONL files. Everything below follows from
that. There is no queue, no database and no vendor SDK, and none of the recovery
procedures require a special tool.

---

## 1. Before launch: the settings that decide whether leads reach a human

An enquiry is written to disk and answered with a reference number whether or
not any of this is configured. Without it, nobody is *told*. That is the failure
mode this section exists to prevent.

| Setting | Without it |
| --- | --- |
| `OPD_NOTIFY_WEBHOOK` **or** `OPD_RESEND_API_KEY` + `OPD_NOTIFY_EMAIL` + `OPD_NOTIFY_FROM` | No alert when an enquiry arrives. The lead waits in `/admin` for someone to look. |
| `OPD_ADMIN_USER` + `OPD_ADMIN_PASSWORD`, or `OPD_ADMIN_USERS` | `/admin` answers 404. There is no way to read enquiries except the JSONL file. |
| `OPD_ADMIN_TOTP_SECRET` (or a per-user `totp`) | The inbox opens on a password alone. It works, and it is logged as `service.inbox_without_mfa` at every start, because one leaked password is the whole customer log. |
| `OPD_SESSION_SECRET` | A random secret is generated per boot, so every deploy — and on a VM, every maintenance reboot the provider performs without asking — signs everybody out of the inbox. `deploy/bootstrap-oracle.sh` generates one into `/etc/opudas.env` on first run and then never rewrites it, because rotating it is a decision and not a side effect of re-running a script. |
| `OPD_ACK_CUSTOMER` + the Resend variables | The visitor gets a reference on screen and then silence. The acknowledgement is on by default *when email is configured*. |
| `OPD_DATA_DIR` on a backed-up volume | A container restart takes the enquiries with it. |
| `OPD_SENTRY_DSN` (**optional**) | Errors are still written to `errors.jsonl`; nobody is paged. |
| `OPD_API_ORIGIN` (**Vercel only**) | The form on the Vercel deployment reports failure honestly and keeps the answers on the visitor's device. Not needed at all on a single-origin host, where nginx serves the site and proxies `/api` (Option D in `docs/deploying.md`): there is then no second origin to name and no CORS rule to get wrong. |
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
    "notificationHealth": {
      "webhook": { "ok": true, "consecutiveFailures": 0, "delivered": 41, "failures": 0, "lastOkAt": "…", "lastFailureAt": null }
    },
    "inbox": true,
    "admin": { "mfa": true, "allowlist": false },
    "limits": { "store": "file", "tracked": 7 },
    "retention": { "operationalLogs": 30, "enquiries": 730 },
    "errorForwarding": true,
    "damagedRecords": 0
  }
}
```

Health is public, so every field above is capability rather than configuration:
which channels exist and whether they are delivering, whether the inbox has a
second factor and an allowlist, whether rate-limit state survives a restart, and
how long data is kept. No account name, no network range, no webhook URL and no
key appears in it, and a test asserts that.

---

## 1a. The inbox: who gets in, as what, and what is written down

Roadmap 17.01.04 (roles), 17.01.12 (multi-factor), 17.01.13 (privileged-activity
log) and 17.02.12 (a named owner with enforced access control). `/admin` holds
every customer name, phone number and message the site has collected, so the
controls around it are the ones that matter most.

**Accounts.** One account is `OPD_ADMIN_USER` + `OPD_ADMIN_PASSWORD`; several named
people are `OPD_ADMIN_USERS`, a JSON array of `{user, password, role, totp}`. Use
the array. An inbox with one shared password cannot answer "who exported the
customer list on Tuesday", and the access log is worth exactly as much as the
accounts are distinct.

**Roles.** `viewer` reads the inbox. `exporter` may also download
`/admin/enquiries.csv` — every customer record leaving the machine in one file,
which is why it is a separate permission and why taking it is logged as its own
decision. A single account defaults to `exporter`, because a one-person business
is the whole audience for that default.

**Second factor.** Standard TOTP (RFC 6238): any authenticator app, 30-second
codes, one step of clock skew tolerated, each code usable once. Enrol with:

```bash
node server/auth.mjs --new-secret "ada"
# prints the base32 secret and an otpauth:// URL to scan; put the secret in
# OPD_ADMIN_TOTP_SECRET, or in that user's "totp" inside OPD_ADMIN_USERS
```

The flow is: credentials → a five-minute unlock page → the code → a signed
session cookie (`OPD_ADMIN_SESSION_TTL`, default one hour). Sessions are
stateless, which is why a copied cookie stays valid until it expires and why
sign-out clears the browser's copy rather than revoking a server-side list — with
no database there is no list. Shorten the TTL if that matters more than
convenience. Guessing codes is limited to six attempts per address per ten
minutes, and getting in clears the counter, so a typo does not spend the budget.

**Where it can be reached from.** `OPD_ADMIN_ALLOW_CIDR` takes IPv4 or IPv6 ranges
and single addresses. Anything outside gets a 404 and a `denied-allowlist` line.
An entry that cannot be parsed allows nothing: a typo closes the inbox rather than
opening it. Leave it unset on a residential connection with no fixed address — the
credentials and the second factor are the controls there, not the network.

**The access log.** Every decision is appended to `server/data/admin-access.jsonl`
and logged as `admin.access`: `denied-allowlist`, `denied-credentials`,
`challenge-mfa`, `denied-challenge`, `denied-rate`, `denied-mfa`, `allowed-mfa`,
`denied-role`, `allowed`, `signed-out`. Each line carries who, from where, which
path, how the identity was proved (`session` or `credentials`) and the answer —
never a password, never a code, never a session token, and never an enquiry's
contents. It is kept 30 days with the other operational logs.

```bash
# who opened the inbox this week
jq -r 'select(.decision=="allowed" or .decision=="allowed-mfa") | [.at,.user,.role,.path] | @tsv' \
  server/data/admin-access.jsonl | tail -20

# every refusal, which is the line to read after any credential is leaked
jq -r 'select(.decision|startswith("denied")) | [.at,.decision,.ip,.user] | @tsv' \
  server/data/admin-access.jsonl
```

**Reviewing access** (roadmap 20.02.04) is a monthly reading of that file plus a
question: does everybody in `OPD_ADMIN_USERS` still need to be there, and does
anybody who does not have a second factor have a reason not to?

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
  → rate limit          (12 per address per 10 min, counted in a file that survives a restart)
  → validate            (the server decides; the browser only advises)
  → honeypot check      (a filled `company` field gets a 201 shaped exactly like the real thing, and is dropped)
  → route               (which desk, and the SLA in hours that goes with it)
  → duplicate check     (an identical enquiry inside 10 minutes returns the first one's reference + duplicate:true)
  → append to quotes.jsonl
  → 201 with { reference, receivedAt, routedTo, slaHours }   ← visitor answered here
  → notify the desk     (webhook and/or email, in the background)
  → acknowledge the visitor (their reference, the desk, the SLA, the phone number — if email is configured)
```

The order matters. The visitor is answered **before** any notification is
attempted, so a slow or dead webhook can never make a submitted enquiry look
broken. Both outbound messages are fired after the response, in the background,
and neither can fail the submission.

Notification delivery:

- is retried twice in-process (0.5 s, then 2 s — `OPD_NOTIFY_RETRY_MS`);
- writes one line per delivery to `notifications.jsonl` — channel, outcome,
  error, reference. Never the enquiry itself, and never the customer's address a
  second time;
- logs `notify.delivered` (desk) and `notify.acknowledgement` (visitor) with
  `ok: true|false`;
- counts outcomes per channel, and logs `notify.channel_down` the moment three
  consecutive deliveries have failed — the line to alert on, because a webhook
  that died on Tuesday is otherwise indistinguishable from a quiet week.

The acknowledgement is a transactional message about the enquiry they just made:
their reference, the desk, the response commitment, the phone number, an echo of
what they asked for, the words "estimate, not a quotation", the data-subject route
with its 30-day deadline, and a line saying plainly that nothing else will be sent
to that address. `OPD_ACK_CUSTOMER=off` disables it.

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
| `quotes.jsonl` / `subscriptions.jsonl` / `unsubscriptions.jsonl` | the enquiry service | the enquiries themselves, newsletter sign-ups, and newsletter opt-outs |

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
| `service.inbox_without_mfa` | startup, the inbox opens on a password alone | enrol a second factor (§1a) |
| `service.retention` | startup, the retention schedule and how much was pruned | the numbers disagree with the privacy notice |
| `enquiry.duplicate_suppressed` | an identical enquiry inside 10 minutes was not stored again | only if a genuine second lead was lost |
| `notify.acknowledgement` | the visitor's own copy, `ok` true/false | `ok:false` means a reference was promised and no message arrived |
| `notify.channel_down` | three consecutive failures on one channel | **immediately** — leads are stored and nobody is being told |
| `notify.privacy_request` | a data-subject request was announced | `ok:false` means a statutory clock is running unseen |
| `privacy.request_received` | a right was exercised, with reference and `dueBy` | the answer is due in 30 days (§5d) |
| `privacy.storage_failed` | the request could not be stored; the visitor was told to email | **immediately** |
| `admin.access` | one line per inbox decision: who, from where, which path, what answer | a burst of `denied-*` from one address |
| `admin.cookie_insecure` | a session cookie was set without the Secure flag over HTTP | TLS is not reaching the service |
| `retention.pruned` | a file was trimmed to its retention period | — |
| `retention.prune_failed` | a file could not be trimmed | data is being kept longer than published |
| `limits.write_failed` | the limiter fell back to per-process memory | limits no longer survive a deploy |
| `limits.damaged_lines` | unparseable lines in `limits.jsonl` were ignored | a write was cut short |

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
| `data.notificationHealth.*.ok` is `false` | 3 consecutive failures | a channel has stopped delivering; log line `notify.channel_down` says it in words |
| `data.admin.mfa` is `false` | any | the customer log opens on a password alone (log line `service.inbox_without_mfa`) |
| `data.limits.store` is `"memory"` | any | a deploy resets every rate limit, and two instances each get their own allowance |
| log `enquiry.storage_failed` | any | enquiries are being refused |
| log `admin.access` with `denied-mfa` or `denied-credentials` | a burst from one address | somebody is guessing at the inbox |
| log `retention.prune_failed` | any | data is being kept longer than the privacy notice says it is |
| 5xx rate on `/api/*` | > 1% over 5 min | site can look fine while the form is dead |
| monthly restore drill | not run in 35 days | a backup nobody restored |

The monthly drill is not a metaphor: run `tools/verify-restore.sh` (it uses
throwaway data), and once a quarter restore a **real** archive into a scratch
directory and reconcile the record count against the archive.

---

## 5b. The four checks, and how often to run them

A monitor nobody runs is a document. These are the checks and the cadence that
makes each one mean something.

| Tool | What it proves | Cadence |
| --- | --- | --- |
| `node tools/uptime-check.mjs --origin https://opudapaint.com` | The live site serves real pages (not a blank shell), the bundle it references exists, health says storage is ready and a channel is configured, the colour book is not truncated, and the sitemap is there. | every 5–15 min from cron, or the scheduled GitHub workflow |
| `node tools/smoke-production.mjs --origin https://opudapaint.com --release <sha>` | The **deploy you just made** is the one answering, the API contract still validates the way the bundle expects, and `/admin` and the CSV export are still closed. | after every deploy, from outside the host network |
| `node tools/load-test.mjs --origin https://staging.opudapaint.com` | The enquiry path holds its latency budget under concurrency, and the rate limiter is the thing that gives way first rather than the service. | before launch, then quarterly or before any campaign (roadmap 18.05) |
| `./tools/rollback.sh --check` | There *is* something to roll back to, and the current release is healthy. | monthly — this is the rollback exercise, roadmap 17.03.09 |

Two details that decide whether the first one is worth having:

- **A dead monitor looks like a healthy site.** Set `OPD_UPTIME_HEARTBEAT` to a
  dead-man's-switch URL (Healthchecks.io, Cronitor, Uptime Kuma). The check pings
  it *only when everything passed*, so the alert that fires when cron stops, the
  host dies or the script breaks is the missing ping, raised by a service whose
  whole job is noticing silence. That service — not GitHub's scheduler — is what
  reaches a phone (roadmap 17.03.02).
- **A check that only reads a status code is a decoration.** Every probe in
  `uptime-check.mjs` asserts something about the response: the mount point and the
  prerendered title are in the HTML, the hashed bundles it references return 200
  and are not truncated, health says `storage: ready`, the PDF is over 100 kB. The
  site's pages are prerendered heads with client-rendered bodies, so a probe
  looking for `<h1>` in the HTML would fail against a perfectly healthy deploy —
  and a monitor that cries wolf gets switched off.

Point the load test at staging, never at production, and note what it measures:
submissions carry the honeypot field, so the service does all the work of a real
enquiry and stores nothing. Twelve per address per ten minutes is the limiter, so
a run from one address reports 429s after the twelfth — which the tool counts
separately and explains, rather than calling a failure. `--vary-ip` only changes
that on a deployment that sets `OPD_TRUST_PROXY`, and the tool says so in its
output when it does not.

---

## 5c. Retention: what is kept, for how long, and by what

Roadmap 16.03.09. The privacy notice publishes two periods, and the service's
defaults are those numbers — they are one promise written in two places, so
changing `app/src/routes/Legal.tsx` without changing the environment (or the
reverse) makes the site say something the service does not do.

| Data | Kept | Configured by | Why |
| --- | --- | --- | --- |
| `notifications.jsonl`, `errors.jsonl`, `admin-access.jsonl` | 30 days | `OPD_RETENTION_DAYS` | delivery receipts, diagnostics and access lines. Useful for weeks; after that only a disk filling up. |
| `quotes.jsonl`, `privacy-requests.jsonl` | 24 months (730 days) | `OPD_ENQUIRY_RETENTION_DAYS` | long enough to answer a follow-up and honour the five-year guarantee; after that, personal data with no purpose, which is what storage limitation exists to prevent. |
| `subscriptions.jsonl` | until withdrawn | not configurable | a consent record lives as long as the consent. |
| `unsubscriptions.jsonl` | forever | not configurable | deleting a suppression record silently resurrects an address that asked to be left alone. |
| `limits.jsonl` | its own window, pruned continuously | `OPD_DEDUPE_MINUTES`, window 10 min | counters and dedupe memos, nothing else. |
| `erasure-log.jsonl` | forever | not configurable | references only: the evidence that a deletion happened, with no personal data in it. |

Pruning runs at startup and then daily, rewrites each file atomically (a backup
running at the same moment never sees a half-written log), and **keeps any line
whose timestamp cannot be read** — guessing that an undated line is old is how an
audit trail loses the one entry somebody later needs. Each run logs
`retention.pruned` with the file, the count dropped and the count kept; a failure
logs `retention.prune_failed`, which is an alert, because retention that quietly
stops running makes a published promise untrue.

Backups are the other half of retention: an archive older than the retention
period is a copy of personal data nobody decided to keep. `tools/backup.sh` keeps
`OPD_BACKUP_DAYS` (30 by default) and deletes what is older.

---

## 5d. Data-subject requests: from intake to answer

Roadmap 16.03.07, NDPA sections 30–36. The privacy notice promises a right of
access, correction and deletion answered within 30 days. The promise now has a
process with a clock on it:

1. **Intake.** The privacy notice carries a form (`POST /api/privacy`) which gives
   the request a `DSAR-` reference, records the right exercised, the address to
   answer at, the enquiry it concerns if any, and the date it is due. Email to
   `hello@opudapaint.com` is still offered next to the form and is still valid —
   the form is a path, not a gate. Requests are rate limited (3 per address per 10
   minutes) and the refusal names the email address, because a person exercising a
   right must never be left with a 429 and nowhere to go.
2. **Announcement.** The request is sent to the desk through the same channels as
   an enquiry, with the deadline in the body: "The clock on this one is statutory,
   not commercial: answer within 30 days."
3. **Verification.** Confirm the requester is who they say before releasing data.
   An enquiry reference plus the address it was submitted from is usually enough;
   for erasure, the address alone is, because the worst case is that we delete
   what they asked us to delete.
4. **Fulfilment.** Access: export from `/admin/enquiries.csv` and send only their
   rows. Correction: edit by hand, and record what changed. Erasure:
   `tools/erase-record.mjs`.
5. **Answer.** Tell them what was done, in writing, before `dueBy`.

Erasure is a tool rather than an editor session, because "delete the right line
from a JSON file by hand" is how a customer's data survives a request to delete
it:

```bash
node tools/erase-record.mjs --email ade@example.com                       # dry run: what would go
node tools/erase-record.mjs --email ade@example.com --request DSAR-261103-4K2P --yes
```

It removes matching enquiries and subscriptions, **adds a suppression entry** so
the address cannot be resurrected by the next sign-up, keeps the request record
(it is the evidence the right was honoured), writes an audit line to
`erasure-log.jsonl` with references only, and refuses to touch a line it cannot
parse. It prints references rather than records, because a tool that echoes what
it is about to delete writes that personal data into a terminal and a CI log. It
is a dry run unless `--yes` is passed.

---

## 6. Backups and restore

Backups: `tools/backup.sh DEST`, nightly, 30-day retention, archives created
`0600` because they contain personal data. Store them off the host, and encrypt
them — the script deliberately does not pretend to solve that.

*Nightly* means either cron (`docs/deploying.md` has the line) or
`deploy/opudas-backup.timer`. On a VM, prefer the timer, for two reasons. systemd
records the exit status of every run, so "did the backup happen?" is
`systemctl status opudas-backup` rather than an argument with syslog. And
`Persistent=true` runs a missed activation on the way back up, so a provider
reboot that swallowed 02:15 costs a late backup instead of a silent gap —
which is the failure named at the end of this section, discovered six months
after it started.

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

**"The desk stopped getting alerts, but enquiries are arriving."**
`/api/health` → `notificationHealth` shows which channel is down, how many
consecutive deliveries have failed and when the last one succeeded; the log has
`notify.channel_down` at the moment it crossed three. Enquiries are still being
stored and are still in `/admin` — the loss is the announcement, not the lead.
Check the webhook URL or the Resend key and quota, then read the references in
`quotes.jsonl` since `lastOkAt` and answer them by hand.

**"Somebody is locked out of the inbox."** A lost phone is the usual cause. The
fix is a configuration change, not a bypass: remove that user's `totp` from
`OPD_ADMIN_USERS` (or `OPD_ADMIN_TOTP_SECRET` for the single-account form),
restart, and re-enrol with `node server/auth.mjs --new-secret "name"`. Every
attempt in between is in `admin-access.jsonl` as `denied-mfa`, which is how you
tell a lost phone from somebody guessing.

**"A password or the session secret leaked."** Change it in the environment and
restart. Rotating `OPD_SESSION_SECRET` invalidates every session at once, which is
the fastest way to end a copied cookie; a session already issued otherwise lives
until `OPD_ADMIN_SESSION_TTL` expires. Then read `admin-access.jsonl` for the
window in question: which addresses were allowed, and what they exported.

**"A customer asked us to delete everything."** §5d, in order: verify, dry-run
`tools/erase-record.mjs`, apply with `--yes` and the DSAR reference, answer them in
writing before `dueBy`. Do not hand-edit `quotes.jsonl`.

**"Two people submitted the same enquiry and only one arrived."** That is
duplicate suppression (roadmap 14.01.05) doing its job: identical submissions
inside ten minutes come back with the first one's reference and `duplicate: true`,
and log `enquiry.duplicate_suppressed`. The fingerprint covers every field the
visitor supplied, so anything that differs at all — a room count, a colour, one
digit of a phone number — is treated as a second enquiry. If a genuine second lead
was suppressed, the window is the thing to change (`OPD_DEDUPE_MINUTES`), not the
feature.

**"The disk filled."** The service answers 503 and tells the visitor to call —
it does not lose the file or truncate it silently. Free space, then run the
repair script in §6, then check `damagedRecords` is zero.

---

## 8. What is deliberately not here

Named so that nobody assumes it exists:

- **No retry queue for notifications.** Two in-process retries, then a record —
  and, since 17.03.05, a counter that says out loud when a channel has stopped
  delivering. A queue would mean re-attempting an announcement hours after the
  lead arrived, which is worse than a person reading `/admin`.
- **No paging and no rota.** `tools/uptime-check.mjs` plus a dead-man's-switch
  heartbeat plus a webhook alert is a way to be told. Who is told, and what they
  do at 2am, is roadmap 17.02.12 and 20.01.01: a name and a rotation, which is a
  business decision this repository cannot make.
- **No session revocation list.** Sessions are stateless, so sign-out clears the
  browser's cookie and a copied token stays valid until it expires. Revoking every
  session means rotating `OPD_SESSION_SECRET`.
- **No CRM.** The JSONL is the system of record; `/admin/enquiries.csv` is the
  export path.
- **No analytics platform.** Page views are a consent-gated `dataLayer` push;
  nothing is sent to a third party until one is chosen.
- **No log shipping.** `OPD_LOG_FORMAT=json` makes it possible; configuring a
  drain is a deployment decision.
