# Launch runbook

Who runs this, in what order, and how to know it worked.

This is the document for launch day and the two weeks after it — roadmap 19.03
(production verification), 20.01 (stabilization) and the two operational
commitments that have to exist before launch rather than after it: 17.02.11
(service levels and recovery objectives) and 17.02.12 (ownership and escalation).

Everything with a `[name]` is a decision this repository cannot make. They are
left visibly blank rather than filled with a plausible guess, because a runbook
with an invented owner is worse than one with a gap: the gap gets noticed, the
invention gets relied on.

---

## 0. The people, filled in before anything else

| Role | Who | How they are reached | Backup |
| --- | --- | --- | --- |
| Business owner (accepts launch) | `[name]` | `[phone]` | `[name]` |
| Inbox owner (answers enquiries) | `[name]` | `[phone]` | `[name]` |
| Technical contact (deploys, restores) | `[name]` | `[phone]` | `[name]` |
| Content contact (colours, dealers, copy) | `[name]` | `[email]` | `[name]` |

Roadmap 17.02.12 asks for a **named** owner with enforced access control. The
access control exists (`docs/operations.md` §1a: accounts, roles, TOTP, an
allowlist, an access log). The name does not, and cannot, come from here.

Escalation: whoever is on the rotation → the technical contact → the business
owner. If a customer's personal data is involved, the business owner is told
immediately rather than after diagnosis, because the NDPA's breach clock runs from
awareness and not from certainty.

---

## 1. Service levels and recovery objectives (17.02.11)

Numbers chosen to match what this system actually is — a lead-generation site on
one host with no database (ADR 0001) — rather than numbers copied from a platform
company's status page. Promising 99.99% here would be a promise about redundancy
that does not exist.

| Objective | Target | Why this number | How it is measured |
| --- | --- | --- | --- |
| Site availability | 99.5% monthly (≈3.6 h of downtime allowed) | A customer who cannot reach the site today comes back tomorrow; there is no checkout to abandon. Anything tighter needs a second host and a load balancer, which is a different architecture. | `tools/uptime-check.mjs` every 5–15 min; a failed run is downtime |
| Enquiry submission | 99.9% of submissions answered 201 within 2 s | The one interaction that must not fail. It is answered before any notification is attempted, so a dead webhook cannot slow it. | `http.request` log lines: `path` + `status` + `ms` |
| Desk response (published SLA) | 24 h, 48 h for dealer enquiries | Already stated on the site and repeated in the acknowledgement email. It is a business commitment, not a technical one. | `/admin`, oldest unanswered enquiry |
| RTO — site back up | 4 hours | Recovery is: roll back (`tools/rollback.sh`) or restore (`tools/restore.sh`), both drilled in CI. Four hours is generous for a procedure that takes twenty minutes and honest about finding a human at 2am. | timed in the quarterly drill |
| RPO — how much data can be lost | 24 hours by default, **1 hour during stabilization** | Backups are nightly (`tools/backup.sh`). During launch week, run them hourly: an enquiry written at 09:00 and lost at 17:00 is a customer who will not submit twice. | `ls -t` the backup destination |
| Data-subject request | answered within 30 days | Statutory (NDPA 30–36) and published in the privacy notice. The intake form states the deadline on screen. | `dueBy` in `privacy-requests.jsonl` |

---

## 2. Before launch day (T-7 to T-1)

Each line has a check, because "we should make sure" is not a task.

- [ ] **Every setting in `docs/operations.md` §1 is set on the production host**,
      and `curl -sS https://<origin>/api/health` shows `storage: ready`, at least
      one notification channel, `admin.mfa: true` and `limits.store: "file"`.
- [ ] **A second factor is enrolled for everybody in `OPD_ADMIN_USERS`**
      (`node server/auth.mjs --new-secret "<name>"`), and each person has signed in
      once with it. Nobody discovers their authenticator does not work on launch
      day.
- [ ] **`OPD_SESSION_SECRET` is set**, or every deploy signs the desk out.
- [ ] **The allowlist decision is made deliberately**: set `OPD_ADMIN_ALLOW_CIDR`,
      or write down why not (a residential connection with no fixed address).
- [ ] **Backups run from cron, and a restore has been performed on the production
      host**, not only in CI: `bash tools/verify-restore.sh`.
- [ ] **`OPD_RETENTION_DAYS` and `OPD_ENQUIRY_RETENTION_DAYS` match the privacy
      notice** (30 and 730). They are one promise in two places.
- [ ] **The monitoring is live and has been seen to fail.** Point
      `tools/uptime-check.mjs` at a host that is down once, on purpose, and confirm
      the alert reaches a phone. A monitor nobody has watched fire is a hope.
- [ ] **`OPD_UPTIME_HEARTBEAT` is set**, so a monitor that stops running is itself
      an alert.
- [ ] **The load test has been run against staging**
      (`node tools/load-test.mjs --origin https://staging.<domain>`) and the p95 is
      inside budget with the rate limiter — not the service — being what gives way.
- [ ] **The dealer data is as true as it can be.** Six of fourteen entries carry
      `verified: false` and render with a "call ahead to confirm stock" note.
      Confirming them is a telephone task with a name against it.
- [ ] **Somebody has read the site on a real phone on a real network**, not a
      simulator (roadmap 15.x; this repository cannot do it).
- [ ] **The rollback exercise has been run on the production host**:
      `./tools/rollback.sh --snapshot` then `--check`, which proves there is
      something to go back to.

---

## 3. Launch day

Order matters. Each step has a verification, and a step that cannot be verified
has not been done.

1. **Snapshot the current release.** `./tools/rollback.sh --snapshot`. If there is
   no current release, note that rollback means "redeploy the previous commit".
2. **Deploy.** `docs/deploying.md`, whichever option the host uses.
3. **Smoke test from outside the host network** — from a laptop on a phone
   connection, not from the server itself, which is the one place a broken DNS or
   TLS setup looks fine:

   ```bash
   node tools/smoke-production.mjs --origin https://<domain> --release <sha-or-tag>
   ```

   It fails the run if the release that answers is not the release that was
   shipped, if health says storage is not ready, if a page renders a shell with no
   bundle behind it, if the API contract changed shape, or if `/admin` and the CSV
   export are reachable without credentials.
4. **Submit one real enquiry** and follow it end to end. This is the only step that
   proves the whole pipeline, and it is worth one record in the log:

   ```bash
   node tools/smoke-production.mjs --origin https://<domain> --write
   ```

   Then confirm, in order: the reference appeared on screen; the acknowledgement
   email arrived at the address given; the desk's channel received the alert; the
   record is in `/admin`; the line is in `notifications.jsonl` with `ok: true` for
   both channels. Delete the record afterwards with
   `node tools/erase-record.mjs --reference <ref> --yes`.
5. **Point DNS**, if it has not been pointed already. Check the old origin still
   answers during propagation, and that `OPD_ALLOWED_ORIGIN` is right for whichever
   origin the site is actually served from — a form served from `www.` against an
   API configured for the apex fails in the browser and looks fine from `curl`.
6. **Turn the monitoring on** (cron or the scheduled workflow) and watch one cycle
   pass green.
7. **Tell the people who answer the phone.** The desk now gets an alert per
   enquiry and the customer gets an acknowledgement with a reference in it. If a
   caller quotes a reference, it is searchable in `/admin` and in `quotes.jsonl`.

**Go / no-go.** Do not proceed past step 3 with a failing smoke test, and do not
proceed past step 4 with an enquiry that arrived on screen but not in the desk's
channel. Both are conditions where the site looks launched and is not.

---

## 4. The first 72 hours (20.01 stabilization)

Twice a day — morning and evening — one named person reads the following. It takes
about ten minutes and the commands are the work.

Log field names below are the real ones: log lines carry `ts` (not `time`), and a
browser fault carries `release` in `errors.jsonl` rather than in the log line.

```bash
# 1. Did leads arrive, and how many?
jq -r 'select(.event=="enquiry.received") | [.ts,.reference,.routedTo] | @tsv' api.log | tail -20

# 2. Did every lead get announced, and did the customer get their copy?
jq -r 'select(.event=="notify.delivered" or .event=="notify.acknowledgement") | [.event,.ok,.reference] | @tsv' api.log | tail -30

# 3. Anything refusing to be stored? (this is the one that loses money)
grep -c enquiry.storage_failed api.log; grep -c privacy.storage_failed api.log

# 4. Browser faults, by release — a spike against one release is a broken deploy
jq -r 'select(.event=="client_error") | [.kind,.path] | @tsv' api.log | sort | uniq -c
jq -r '.release // "unknown"' server/data/errors.jsonl | sort | uniq -c

# 5. Status histogram and the slowest requests
jq -r 'select(.event=="http.request") | .status' api.log | sort | uniq -c
jq -r 'select(.event=="http.request") | "\(.ms)\t\(.path)"' api.log | sort -rn | head

# 6. Who touched the inbox, and who was refused
jq -r 'select(.event=="admin.access") | [.at,.decision,.user,.ip] | @tsv' server/data/admin-access.jsonl | tail -20

# 7. Data-subject requests and their deadlines
jq -r '[.receivedAt,.reference,.type,.dueBy] | @tsv' server/data/privacy-requests.jsonl

# 8. Is the oldest enquiry still inside its published SLA?
jq -r '[.receivedAt,.reference,.routedTo,.slaHours] | @tsv' server/data/quotes.jsonl | tail -5
```

Also during stabilization:

- **Run backups hourly**, not nightly (the RPO row in §1).
- **Check indexing and crawl errors** (20.01.06): Search Console coverage, the
  sitemap (`/sitemap.xml`, 104 URLs), and that a sample of prerendered pages shows
  the right title when fetched without JavaScript.
- **Reconcile what was measured against what arrived** (20.01.07): analytics is
  consent-gated and off by default, so the honest comparison is
  `quote_submit` events against `enquiry.received` lines. A wide gap is a form
  problem, not a marketing one.
- **Log every defect** with its severity, even the ones fixed in five minutes
  (20.01.08). The list is what the stabilization review reads.

**Severity, and what each one means for launch week.**

| Severity | Definition | Response |
| --- | --- | --- |
| 1 | Enquiries are not being stored, or the site is down, or personal data is exposed | stop everything; roll back first, diagnose second; tell the business owner immediately |
| 2 | Enquiries are stored but not announced, or a page is broken for a common path | same day; the desk works from `/admin` in the meantime |
| 3 | Cosmetic, content, or an uncommon path | this week |
| 4 | Improvement | backlog |

**Roll back first, diagnose second** is the rule for severity 1 and 2. The release
stamp is on every error report and in `/api/health` as `version`, so the diagnosis
survives the rollback — and `./tools/rollback.sh` keeps the release it replaced, so
rolling forward again is as easy as rolling back was.

**Closing stabilization** (20.01.09): a review with the four people in §0, reading
the defect list, the enquiry counts, the SLA compliance and the monitoring history.
The output is a decision that launch is complete, plus the deferred-work list
(22.10) — which for this project is `docs/remaining-work.md`.

---

## 5. After stabilization: the ongoing cadence (20.02)

| Cadence | Task | Command or place |
| --- | --- | --- |
| Every 5–15 min | Uptime check, with a heartbeat | `tools/uptime-check.mjs` (cron or the scheduled workflow) |
| After every deploy | Snapshot, then smoke test | `./tools/rollback.sh --snapshot` → `tools/smoke-production.mjs --release <sha>` |
| Nightly | Backup | `tools/backup.sh <dest>` |
| Weekly | Read the access log; check dependency alerts | §4 item 6; Dependabot pull requests |
| Monthly | Restore drill; rollback exercise; access review; retention sanity | `tools/verify-restore.sh`; `./tools/rollback.sh --check`; `OPD_ADMIN_USERS`; `/api/health` → `retention` |
| Quarterly | Load test against staging; a real archive restored and reconciled; dealer and product data audit | `tools/load-test.mjs`; `tools/restore.sh`; `app/src/data/dealers.ts` |
