# The Android application

Read this if you are building, testing, extending or releasing the phone app.
For *why* it is built this way, read [ADR 0004](adr/0004-native-android-app.md).

The app is native Kotlin with Jetpack Compose. It is not a web app, not a WebView,
and not a wrapper around the site: there is no HTML in it. It reads the same
generated content the website reads, works with no signal at all, and queues
submissions until it can deliver them.

## What is here today

71 Kotlin files in `android/app/src/main/java/com/opudas/paint/`, thirteen
features, and 73 JVM tests in 5 suites.

| Journey | Screen | Notes |
| --- | --- | --- |
| Home | `feature/home` | Brand surface, the colour library, the calculator, where to buy |
| Colours | `feature/colours` | 59 colours, 9 families, 8 rooms, 4 collections; filtered list and detail |
| Products | `feature/products` | 6 products; coverage, coats, recoat times, packs, data sheets |
| Calculator | `feature/calculator` | The quantity engine; a worked example matches `calculator.ts` exactly |
| Dealers | `feature/dealers` | 14 dealers, sorted state → city → name; six marked as still being confirmed |
| Palettes | `feature/palettes` | 9 curated palettes with the room each colour is doing a job in |
| Projects | `feature/projects` | 19 project guides with galleries, colours, products and a takeaway |
| Guides | `feature/guides` | 6 guides, 19 sections, callouts, questions, dated and attributed |
| Quote | `feature/quote` | The enquiry form, queued locally, tracked afterwards |
| Data request | `feature/privacy` | The five rights, through the same outbox |
| Tools | `feature/tools` | Finish finder (14 weighted rules), 10 preparation sequences, hub |
| Legal notices | `feature/legal` | Privacy, terms and accessibility, readable offline |
| More | `feature/more` | The hub, with honest counts from the bundles |

**Not built yet.** Four journeys have no code: the board and checklist, the document
viewer, the visualiser, and settings. The admin inbox is not merely unfinished but blocked — see
[the inbox](#the-admin-inbox-is-blocked-on-a-server-endpoint) below.

Eight routes are declared in `navigation/Destinations.kt` and deliberately not wired
into the graph, because a route that leads nowhere should not be reachable: `BOARD`,
`CHECKLIST`, `DOCUMENTS`, `DOCUMENT_VIEWER`, `INBOX`, `INBOX_DETAIL`, `SETTINGS`,
`VISUALISER`. They are the reserved shape of the remaining work, not an oversight.
Wire one in the same commit as the screen that answers it.

## How the content gets in

The app never contains a copy of the data. It ships the generated bundle:

```
cd app && npm run data:android          # app/src/data/*.ts  ->  android/.../assets/data/*.json
python3 tools/build-android-icons.py    # the brand mark      ->  launcher PNGs
```

`tools/build-android-data.mjs` writes ten bundles — colours, products, palettes,
projects, guides, legal notices, dealers, tools, media and theme — from the same typed modules the
website builds from. This is ADR 0002 applied to a second consumer: one source of
truth, generated output, no transcription to drift.

The Android workflow regenerates the bundle and the icons and **fails if what is
committed differs by a byte**. If you change a colour in `app/src/data/colors.ts`,
run `npm run data:android` and commit the result; CI will not let you forget.

The legal notices needed extracting first: they lived as a `DOCS` array inside
`app/src/routes/Legal.tsx`, which only the website could read. They are now
`app/src/data/legal.ts` — typed, tested by `data.test.ts`, and rendered by the website
from the same module, so there is one notice with two readers rather than two notices.
All 29 website routes render the same character counts before and after the move.

`ContentRepository` reads those bundles once, lazily, and exposes the accessors the
screens use (`colors`, `colorsByIds`, `product`, `palettesFor`, `guide`,
`dealerStates`, `sheenLabel`, `legalDocs`, `media`, `themeSync` and the rest). A screen that
needs one record by id calls the id-accessor; it does not filter a list itself.

## Architecture

```
assets/data/*.json  ->  ContentRepository  ->  ViewModel (StateFlow)  ->  Compose screen
                     OutboxRepository (Room)  ->  OutboxWorker (WorkManager)  ->  ApiClient
```

- **`core/data/model`** — the bundle's shapes as data classes. Fields match the
  TypeScript types exactly, including optional ones, because a field the app
  expects and the bundle does not have is a crash rather than a blank.
- **`core/data/local`** — one Room table, the outbox. Its schema directory
  (`android/app/schemas/`) is uploaded as a CI artifact so a migration is reviewable.
- **`core/data/remote`** — the service's contract as types (`ApiModels.kt`) and the
  HTTP client. `Json` is configured with `ignoreUnknownKeys = true`,
  `encodeDefaults = false` and `explicitNulls = false`, and required payload fields
  carry no default, so an omitted field is a compile error rather than a 422 in
  production.
- **`core/engine`** — the logic, ported from TypeScript and tested: `QuantityEngine`
  (areas, coverage, pack selection), `AdvisorEngine` (the finish finder's weighted
  rule table) and `ColorMath` (contrast, blending).
- **`core/sync`** — the WorkManager worker that drains the queue.
- **`core/designsystem`** — theme tokens read from the bundle at runtime, plus the
  shared components: `ColourSwatch`, `HeroSwatch`, `SectionHeader`, `FactRow`,
  `FilterChipRow`, `HonestyBadge`, `HonestNote`, `FormField`, `PrimaryAction`,
  `SecondaryAction`, `ContactActions`, `LoadingState`, `EmptyState`, `TabGlyph`.
- **`core/util`** — `AppCopy` (the fixed sentences), `Intents` (dialler, WhatsApp,
  maps, share sheet — each returns whether it succeeded), `Numbers` (JS-faithful
  number rendering), `Dates` (dates a person reads).

Every ViewModel is constructed through `viewModelFactory` from `context.container`,
so there is no DI framework and no global singletons.

## Offline, and what "sent" means

Everything reads offline. Only submissions need a network, and they do not need one
at the moment of the tap.

A submission is written to the outbox first and the person is told so:

| State | What the screen says | What happens next |
| --- | --- | --- |
| `pending` | Queued, with the local reference | WorkManager delivers when connectivity returns |
| `sent` | Delivered, with the service's reference, which desk took it, and how many hours that desk has | Pruned after 30 days |
| `failed` | Refused, with the service's own words and per-field errors | Retry is offered; a refusal is never retried silently |
| `unreachable` | Not delivered yet | Retried with exponential backoff, up to 20 attempts |

The distinction that matters: **unreachable stays pending, refused becomes failed.**
A service that says "that phone number is too short" has answered; retrying it
forever would be arguing. A service that did not answer has not refused anything.

Work is unique (`opudas-outbox-sync`, `ExistingWorkPolicy.KEEP`) with a network
constraint, so a burst of taps produces one job rather than twenty. Delivery is
persisted across process death and reboot. The whole reply is stored, not only the
reference, because a phone that remembered less than a browser would give a weaker
confirmation about the same enquiry.

Credentials and session cookies are never written to disk.

## Building and testing

```
cd android
./gradlew testDebugUnitTest     # the 54 JVM tests
./gradlew lintDebug             # findings are routed to stdout, not to a file nobody opens
./gradlew assembleDebug         # the APK
```

The JVM tests cover the portable parts: the quantity engine against the website's
worked example, the finish finder's fourteen rules including its tie-break and the
one answer that recommends nothing, the enquiry form's six validation rules and its
routing contract, the data-request form's rules and the five rights the service
accepts, and the date formatting including its silent failure modes. Compose screens, Room and
WorkManager need an instrumented device or emulator, which this repository does not
yet run.

`tools/check-android-static.py` is a stdlib-only pre-flight for the traps that do
not need a compiler: nested block comments, unbalanced braces, `return` in an
expression-body function, missing resource and asset references, imports of
internal packages, unbraced qualified string interpolation, and a simple name
imported from two different packages tree-wide. It runs in under a second:

```
python3 tools/check-android-static.py
```

It cannot see Kotlin semantics — it will not catch an unresolved external symbol or
a call to a repository method that does not exist. It exists because the CI build
takes five minutes and these seven mistakes have each cost one.

## CI

`.github/workflows/android.yml` runs on every branch: regenerate the bundle and
icons, fail on drift, run the pre-flight, then build, unit-test and lint. It
attaches the debug APK and the Room schemas as artifacts.

When the build fails, the workflow posts a **commit comment** with the digest of
what broke. Read failures with:

```
gh api repos/CyberElias-TechPros/opd-paint/commits/<sha>/comments --jq '.[].body'
```

Job logs and artifact downloads are not reliably retrievable from this environment,
which is why the workflow reports its own findings.

## The honesty rules the app inherits

These are not app-specific; they are the product's rules, and they are enforced by
data rather than by judgement:

- **No prices, no stock claims, no cart.** ADR 0003. A pack's `inStock` flag is
  never rendered, because nothing in this system updates it.
- **`claimsStatus: pending-verification` renders as an unverified badge.** Four of
  six products carry it. The app may not make a claim the business has not
  confirmed.
- **Six of fourteen dealers are `verified: false`**, and say so, with the note that
  stock and opening hours are being confirmed and to call before travelling.
- **Sheen is described in the supplier's own words** (`sheenLabels`), not as a
  number on a scale the data never states.
- **Deadlines are written out** in the reader's locale. A statutory date is the one
  number in the app nobody should have to translate in their head.

## What is gated, and must not be faked

- **No release signing keystore.** CI attaches a debug APK. Publishing to Play
  needs a key that does not exist in this repository and should not.
- **`targetSdk` is 34**, not 35. Moving up needs AGP 8.6.x and edge-to-edge by
  default, and there is no signed release to verify it against.
- **Nothing is deployed at `https://opudapaint.com` yet.** `ApiConfig.BASE_URL`
  points there because that is the documented production host. Until the service is
  live, every submission is queued and then fails as unreachable — which the app
  reports honestly rather than pretending to send.
- **Deep links use `autoVerify="false"`**, because verified app links need a hosted
  asset statement on a deployed domain.

## The admin inbox is blocked on a server endpoint

The inbox's only machine-readable endpoint is `GET /admin/enquiries.csv`, and it is
restricted to the `exporter` role on purpose: it takes every customer's name, phone
number and message off the machine at once.

A phone app that read the inbox through that endpoint would force every user to hold
the most privileged role, and would download the entire log to read one enquiry.
That defeats the roles and the minimisation the access model was built for. So the
app needs a JSON inbox endpoint a `viewer` may read. Until it exists, the inbox in
the app is blocked, not unfinished — and `INBOX` / `INBOX_DETAIL` stay unwired.

The rest of the admin flow is already understood and implementable against today's
service: `GET /admin` with Basic auth returns a second-factor challenge and sets the
`opd_mfa` cookie; `POST /admin/second-factor` takes a form-encoded `code` and
exchanges it for the signed `opd_admin` session cookie; `POST /admin/sign-out`
clears both. The challenge expires after 300 seconds and six wrong codes in ten
minutes lock the attempt out. An app implementing this needs a cookie jar and must
not persist any of it.

## Known warnings

`lintDebug` reports `OldTargetApi` for `targetSdk 34`. It is deliberate, for the
reason given above, and it is a warning rather than an error so the build stays
green while it is a decision and not a mistake.
