# ADR 0005 — Hosting on an Always Free VM, not on a platform

- **Status:** accepted
- **Date:** 2026-11-05
- **Answers:** the owner's question about a free backend for the site and the app; roadmap 22.03 (deployment documentation), and the production-host item that `docs/android.md` lists as gated
- **Related:** ADR 0001 (one service, append-only JSONL, no database, "closer to zero" budget), ADR 0004 (the app posts to the same API, so the service has to be reachable from a phone)

## Context

Everything in this system is one Node process and a directory of JSON lines. That
shape was chosen deliberately (ADR 0001), and it puts four hard requirements on
wherever it runs:

1. **A disk that survives the process.** `quotes.jsonl`, `privacy-requests.jsonl`
   and `subscriptions.jsonl` are personal data under the NDPA. A filesystem that
   is discarded when a container is replaced is not storage, it is a cache with
   legal obligations attached.
2. **Exactly one writer.** The store is append-only files with an atomic `rename`
   for retention pruning. Two instances appending to one `quotes.jsonl` interleave
   partial lines, and the failure is a damaged record discovered later by
   `/api/health`. This rules out any platform whose answer to load or to a deploy
   is "run another replica".
3. **No spin-down.** A cold start is a visitor's enquiry waiting thirty seconds,
   and the app's outbox retrying against a service that is asleep looks exactly
   like a service that is down.
4. **A restart must not sign the inbox out.** `OPD_SESSION_SECRET` is unset by
   default and the service then generates a per-boot random, which is the safe
   default for a deployment that has not decided anything yet. On a host that
   reboots without asking, it means the person who answers enquiries is logged out
   at arbitrary moments, for no reason they can see.

The budget is "closer to zero" (ADR 0001), and the test is the same one that ADR
was written against: *can somebody who did not build this fix it at 7pm on a
Saturday?* A hosting choice that only its own author can operate fails that test
no matter how cheap it is.

## Decision

**Host the whole thing — the static build, the service and the enquiry log — on
one Oracle Cloud Always Free VM, behind nginx on the same origin, managed by
systemd, with the configuration and the session secret in a root-owned file on
disk and the enquiry log backed up off-host nightly.**

This is `docs/deploying.md` Option D, and the artefacts are:

```
deploy/bootstrap-oracle.sh      idempotent first-run: Node, swap, user, env file,
                                host firewall, units — and a summary of what only
                                a human can do
deploy/opudas.service           the service; EnvironmentFile is required, not
                                optional, so a missing configuration refuses to
                                start rather than starting half-configured
deploy/opudas-backup.service    one run of tools/backup.sh, as a oneshot unit
deploy/opudas-backup.timer      nightly, with Persistent=true so a reboot that
                                swallowed 02:15 runs the missed backup on the way
                                back up
deploy/nginx.conf               TLS, compression, caching, and /api proxied to
                                127.0.0.1:8787 — one origin, so no CORS rule and
                                no OPD_API_ORIGIN seam
```

The reason for nginx rather than letting the service serve everything: TLS
termination and renewal is the one part of this that has to work unattended for
years, and certbot plus a mainstream web server is the version of that which a
stranger can debug at 7pm on a Saturday. `OPD_STATIC_DIR` remains available for a
single-process deployment, and Option B still describes it.

## Options considered

**Vercel (where the site already is) for everything.** Rejected, and it is
already documented as rejected in Option C: a serverless function has no durable
filesystem, so there is nowhere for the enquiry log to live. It can host the
site. It cannot host this service, and `OPD_API_ORIGIN` exists only to paper over
that seam. One origin is strictly better than two: no CORS configuration to get
wrong, no second place for a certificate or a redirect to break, and the app's
`ApiConfig.BASE_URL` is the same host as the site it links from.

**Render's free tier.** Rejected on requirements 1 and 3: the filesystem is
ephemeral and the service spins down after about fifteen minutes of quiet, with a
cold start measured in tens of seconds. A paint manufacturer's site is quiet
overnight and on Sundays, which is most of the week, so this would be asleep for
the majority of the time it exists.

**Fly.io's free allowance.** The closest competitor, and the reason it was not
chosen is durability of the offer rather than capability: it provides persistent
volumes and does not spin down, which satisfies every requirement above. But it
needs a payment card, its free allowance is expressed as credit that is consumed,
a stopped machine holding a volume still costs, and Railway — the comparable
option — ended its free plan outright in 2023. A hosting decision that has to be
re-made whenever a vendor reprices is a worse decision than one that costs
nothing and is ours to operate. (These are third-party reports of current terms;
check them against the vendors before relying on them.)

**A paid VM (Hetzner, DigitalOcean, Lightsail) at roughly $4–6 a month.** Genuinely
attractive, and the honest answer is that it is a better product: more
predictable, no reclamation risk, better network. It was not chosen because the
constraint given was $0 and because nothing in this workload is large enough to
need what the money buys. It is the first place to go if the Always Free tenancy
proves unreliable, and the migration is a `rsync` and a DNS change — which is the
property worth having designed for.

**Kubernetes, or any container orchestration.** Rejected by requirement 2 before
any other consideration. A single writer is the whole architecture; an orchestrator
whose job is to run more replicas is a machine for corrupting the enquiry log.

## Consequences

**Good.** Recurring cost is zero and stays zero, on a real VM with a real
200 GB block volume. One origin means the site, the API and the app all agree
about where the service is, and the `OPD_API_ORIGIN` seam disappears entirely.
The enquiry log is on a disk we control, backed up by a timer that records its own
failures, and restorable with a script that CI already proves works on every push.
Nothing here is proprietary: the artefacts are a shell script, three systemd
units and an nginx config, all of which can be read end to end in an afternoon.

**Costs, and they are real.** We own patching, TLS renewal, the firewall and
off-host backups — four things a platform would have done for us. There are two
independent firewalls (the VCN security list in the console and the host rules in
the image), and opening only one produces a site that is correctly configured and
unreachable, which is the failure mode most likely to cost an afternoon. ARM
capacity in a home region is often unavailable, so the plan assumes the AMD Micro
shape. Building on an eighth of an OCPU is slow; the measured figure is roughly
530 MB of additional resident memory and 20 seconds on two cores, so a 1 GB
instance fits with swap and patience, and building in CI is the better habit.

**The one consequence that is not ours to fix.** Oracle documents that idle
Always Free compute instances may be stopped or reclaimed, and a low-traffic
brochure site is idle by most measures. The documented remedy is upgrading the
tenancy to Pay As You Go, on which Always Free resources remain free — that needs
a payment card and a business decision, not a commit. Until it is made, the VM
should be treated as restartable rather than durable: the log is backed up
off-host, `Persistent=true` recovers a missed backup, and the app's outbox holds
submissions across an outage and delivers them when the service returns. That last
property is why this is survivable at all, and it came from ADR 0004 rather than
from anything decided here.

## What would make us revisit this

- **Traffic that needs more than one instance.** Requirement 2 forbids solving
  that by adding a replica, so the real trigger is a second writer plus a store
  that tolerates one — which is ADR 0001 being superseded, not this record.
- **The tenancy is reclaimed, or Oracle reprices Always Free.** Move to a paid VM.
  The artefacts here are portable by design: nothing in `deploy/` is Oracle-specific
  except the firewall step in the bootstrap.
- **Somebody is hired to operate it.** At that point the honest comparison is
  against a managed platform, and the four requirements above are the criteria to
  re-check, in the same order.
- **The business starts selling online (ADR 0003 superseded).** Orders and payments
  need transactional guarantees that append-only JSONL on one VM does not provide,
  and this decision would not be the first thing to change.
