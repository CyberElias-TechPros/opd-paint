# ADR 0004 — A native Android app reading the generated bundle, with a local outbox

- **Status:** accepted
- **Date:** 2026-11-03
- **Answers:** roadmap 122 (companion Android app), and the owner's request for a full native application covering the whole product including the admin inbox
- **Related:** ADR 0001 (one service, no database), ADR 0002 (typed data as the single source of truth), ADR 0003 (no e-commerce, so the app's job ends at an enquiry)

## Context

The product is a prerendered static site plus one small dependency-free Node
service. Its facts — 59 colours, 6 products, 9 palettes, 19 projects, 6 guides,
14 dealers — live in typed TypeScript modules and are compiled at build time into
everything that consumes them: 110 HTML documents, and a set of generated JSON
bundles.

The owner asked for the same product as a native Android application: not a web
app, not a wrapper around the site, and including the admin inbox.

Four facts about the use shape the answer:

1. **The signal is worst where the app is most useful.** A contractor measuring a
   room, a customer standing in a shop, a decorator in a basement. An app that
   needs a network to show a colour chart is an app that fails at the moment it
   was opened for.
2. **Content is generated, not fetched.** ADR 0002 already decided that the typed
   modules are the single source of truth and that consumers read *generated*
   output. A phone is another consumer.
3. **There is nothing to buy.** ADR 0003 rules out carts, checkout, payments,
   accounts and live stock. So the app's transactional surface is exactly one
   thing: an enquiry reaching a person at a desk.
4. **An enquiry that is silently dropped is worse than no app.** A form that waits
   for a service before it tells the person anything loses submissions in precisely
   the places the app is used, and the failure looks identical to nothing
   happening.

## Decision

**A native Android application in Kotlin with Jetpack Compose, which ships the
generated content bundle inside the APK, works entirely offline, and writes
submissions to a local outbox that a background worker delivers when connectivity
returns.**

```
android/app/src/main/assets/data/*.json    the generated bundle, byte-identical to the website's source data
android/app/src/main/java/com/opudas/paint/
    core/data/          ContentRepository (reads the bundle), the outbox repository
    core/data/local/    Room: one table, the queue
    core/data/remote/   the service's contract as types, and the HTTP client
    core/engine/        the quantity maths, ported from calculator.ts
    core/sync/          the WorkManager worker that drains the queue
    core/designsystem/  theme tokens from the bundle, and the shared components
    feature/…           one package per journey: colours, products, calculator,
                        dealers, palettes, projects, guides, quote, privacy, more
tools/build-android-data.mjs               app/src/data/*.ts  ->  assets/data/*.json
tools/build-android-icons.py               the brand mark      ->  launcher PNGs
tools/check-android-static.py              pre-flight for the traps that do not need a compiler
```

with the disciplines that make it safe:

- **The bundle is generated, never hand-copied.** `npm run data:android` writes it
  from the same TypeScript modules the site builds from, and the Android workflow
  regenerates it and fails if what is committed differs by a byte. A Kotlin
  transcription of the data would be a second source of truth and would drift.
- **Everything reads offline; only submissions need a network.** Colours,
  products, guides, dealers and the calculator's maths are all local. The app has
  no loading spinner that depends on a server.
- **Submissions are written down before they are sent.** The tap commits a row and
  returns. Delivery is WorkManager's job, with a network constraint, persisted
  across process death and reboot, exponential backoff, and a ceiling of twenty
  attempts.
- **The service's reply is kept whole.** Not only its reference: which desk the
  enquiry was routed to, and how many hours that desk has. A phone that stored only
  a number would give a weaker confirmation than a browser, about the same enquiry.
- **The honesty rules travel with the data.** `claimsStatus: pending-verification`
  renders as an unverified badge; a pack's `inStock` flag is never rendered at all;
  six of fourteen dealers are marked as being confirmed. The app inherits the
  website's constraints rather than getting its own more generous ones.

## Options considered

**A WebView or Capacitor wrapper around the existing site.** Rejected first by the
owner's explicit instruction — "don't do web app" — and then on the merits: it
would not work offline, could not deliver a submission in the background, would
inherit the site's responsive layout as a phone UI it was never designed for, and
would still need every native bridge (dialler, WhatsApp, maps, share sheet) written
by hand. The only thing it saves is the Kotlin, which is the part that is cheap.

**Flutter or React Native.** Rejected. Both are capable and both would work
offline. Both also add a second toolchain, a second rendering stack and a second
release process to a repository that currently has one language for content and one
for the service. Kotlin and Compose are first-party on the target platform, and the
quantity engine ported from `calculator.ts` is the only logic worth worrying about,
in any of the three.

**Fetching the content from the service at runtime.** Rejected. Nothing would work
without signal, the bundle would need versioning and caching anyway to be usable,
and the service would become a hard dependency for looking at a colour chart. The
bundle is already generated and already drift-checked; shipping it in the APK is
strictly more reliable.

**Porting the data into Kotlin by hand.** Rejected by ADR 0002, which exists
because two copies of the same facts drift. The generated JSON is the port.

**Submitting only while online, with an error when that fails.** Rejected. It is
the option that loses enquiries where the app is used most, and it tells the person
something went wrong without telling them what to do about it.

## Consequences

**Good.** The app works with no signal at all, including the calculator and the
whole content library. A submission made on a flight arrives on landing without the
person doing anything. The content has one source, so a colour added to the
TypeScript module appears in the site, the printed catalogue and the app from one
change. Every state the app can be in — queued, delivered, refused with reasons —
is a state it can describe honestly.

**Costs.** The bundle has to be regenerated when data changes; the drift check in
CI is what stops that being forgotten, and it fails the build rather than warning.
The APK grows with the media it ships (49 images, the colour book and every data
sheet). Content changes reach phones only through an app update, not instantly —
which is the same trade the static site already made, and it is why the admin inbox
matters more on a phone than on a site.

Room migrations have to be written rather than defaulted: the one table holds
submissions that have not been accepted yet, and `fallbackToDestructiveMigration`
would lose a customer's enquiry quietly on upgrade, at the moment they believe it
was sent.

**One consequence needs a server change.** The admin inbox's only
machine-readable endpoint is `GET /admin/enquiries.csv`, which is deliberately
restricted to the `exporter` role because it takes every customer's name, phone
number and message off the machine at once. A phone app that read the inbox through
that endpoint would force every user of it to hold the most privileged role, and
would download the whole log to read one enquiry — which is the opposite of what
roles and data minimisation are for. So the app needs a JSON inbox endpoint that a
`viewer` may read, and until that exists the inbox in the app is the part of the
product that is genuinely blocked rather than merely unfinished.

**Resolved.** `GET /admin/enquiries.json` exists now: a page of at most 200 enquiries,
newest first, readable by a `viewer` or an `exporter`, in the same envelope as every
other route, and pinned by eight tests in `server/admin.test.mjs`. The CSV stays
`exporter`-only, because a bulk export is still a bulk export and widening it would
have been the easy way to get this wrong. `INBOX` and `INBOX_DETAIL` are wired in
`feature/inbox`, and the session lives in an in-memory cookie jar that is never
written down. The decision this records is unchanged; the thing it was waiting for
arrived.

## What would make us revisit this

- **A CMS lands (roadmap phase 09).** If content starts changing faster than app
  releases, the bundle-in-APK decision needs a refresh path: a versioned content
  endpoint, a delta, and a cache. That is a different decision from fetching
  everything at runtime, and it should be made then, not now.
- **The business starts selling online.** ADR 0003 would be superseded first, and
  an app with a cart needs live stock and prices — neither of which exists anywhere
  in this product today, and neither of which a generated bundle can carry.
- **Live inventory becomes real.** The moment a system actually knows whether a
  dealer has a 20-litre on Tuesday, the decision to never render `inStock` is
  revisited — not before, because rendering a flag nothing updates is a stock claim
  the business cannot keep.
- **The app needs to run on iOS.** That is the point at which "Kotlin and Compose"
  stops being obviously right and a shared-runtime option deserves a real
  comparison. Until then, one platform and one toolchain is the cheaper thing to be
  correct about.
