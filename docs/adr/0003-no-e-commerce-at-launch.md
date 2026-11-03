# ADR 0003 — No e-commerce at launch: lead generation and a dealer network

- **Status:** accepted
- **Date:** 2026-11-03
- **Answers:** roadmap 01.04.01 (catalog-led, lead generation, e-commerce or hybrid), 02.02.13 (order history and delivery tracking — deferred with this decision), 22.10 (deferred work and future dependencies)
- **Related:** ADR 0001 (no database, which this decision makes survivable), ADR 0002 (prices are not in the data model at all)

## Context

The roadmap asks, first and before any technology choice, what the site is *for*:
catalogue, lead generation, direct e-commerce, or a hybrid. That question decides
whether there are orders, stock, payments, accounts and refunds — and therefore
whether there is a database, a payment provider, PCI scope and a support function.

The facts on the ground:

- Paint reaches customers through a **dealer network**: 14 dealers are listed, 6 of
  them still unverified. The manufacturer's relationship is with the dealer, not
  the person holding a brush.
- **Prices are not published**, and not because they are secret. A job's price
  depends on surface, condition, area and how much preparation is needed, which is
  why the site's calculator produces an *estimate in litres* and the desk produces
  a quotation. Publishing a per-litre price next to an estimate invites a customer
  to believe the estimate is a price.
- The product is **heavy, liquid and tinted**: 20-litre pails, mixed to a
  specific colour, delivered to a site. That is a logistics business, not a parcel
  business.
- There is **no support team** for orders: nobody to answer "where is my paint",
  process a refund, or absorb a chargeback, at launch.
- The team that will maintain the site has **no operations function** (ADR 0001).

## Decision

**The site does not sell. It generates qualified enquiries and sends customers to
dealers.**

Concretely, what exists:

- A **quote request** (`POST /api/quotes`) that collects the job — project type,
  rooms, city, colours, measured quantities — routes it to the right desk
  (colour, technical, trade, commercial) and commits to a response time in hours.
- A **paint calculator** that turns dimensions into litres and packs, with the
  coverage rate that produced it shown, and the words "estimate, not a quotation"
  attached to every number.
- A **dealer locator**, with unverified dealers carrying a “call ahead to confirm stock” note rather than
  being quietly omitted.
- A **sample and colour consultation** path (`projectType: 'sample'`), because
  "can I see it on a wall first" is the question that precedes every purchase.
- Phone and WhatsApp, published in the footer and repeated in the acknowledgement
  email, because a customer who wants to talk to somebody should not have to find
  a form.

And what does not exist, deliberately: no cart, no checkout, no payment provider,
no order history, no delivery tracking, no customer accounts, no stock levels, no
published prices.

This is enforced by a test, not by a convention. `app/scripts/smoke.tsx` fails the
build if any page emits JSON-LD containing `price`, `offers` or `availability` —
because structured data that says a product is buyable is how a site that does not
sell starts appearing in search results as one that does, and how a customer
arrives expecting to pay.

## Options considered

**Direct e-commerce.** Rejected on every axis above: no published price to charge,
no logistics for tinted 20-litre pails, no support function for orders, and a
payment integration that brings PCI scope, fraud handling and a refund process to
a team with no operations function. It would also have forced ADR 0001 to be
reopened immediately: orders need transactions, and stock needs truth.

**Hybrid — buy online where a dealer cannot serve.** The most attractive option,
and the one most likely to be proposed again. Rejected *at launch* because it
needs the two things launch does not have: a published price list the business has
approved, and a delivery answer for areas the dealer network does not cover. A
hybrid that only works in Port Harcourt is a direct-sales business with extra
steps, and it competes with the dealers the site exists to support.

**Catalogue only — no enquiry path.** Rejected. It is the cheapest option and it
measures nothing: the business would learn that people read the colour library and
nothing else. The enquiry is the point of the site, and the routing and SLA on it
are what make it a lead rather than a message.

## Consequences

**Good.**

- **No PCI scope, no payment vendor, no chargebacks.** Nothing that can take money
  can lose it.
- **A small personal-data footprint.** The site holds enquiries, newsletter
  consent, opt-outs and diagnostics — no accounts, no passwords, no order history,
  no addresses. Every NDPA obligation that remains (retention, erasure, access,
  the 30-day clock) is implemented: `POST /api/privacy`, `tools/erase-record.mjs`,
  and the retention schedule in `docs/operations.md`.
- **No stock truthfulness problem.** A site that says "in stock" and is wrong has
  told a customer a lie. This site never claims availability.
- **The architecture stays proportional** (ADR 0001): append-only files are enough
  for enquiries, and would not have been enough for orders.

**Bad, and accepted.**

- **No revenue attribution.** The site can show that 40 enquiries arrived and which
  desk they went to; it cannot show what they were worth. Reconciling analytics
  against actual orders (roadmap 20.01.07) is not possible until the desk records
  outcomes somewhere, which is a business process and not a website feature.
- **The dealer network is a business-critical dependency.** Six of the fourteen
  dealers are unverified: a customer sent to a wrong phone number has been sent on
  a wasted journey, and the site's usefulness is only as good as that data. The
  `verified` flag is rendered so nobody mistakes one for the other.
- **Customers who want to buy now cannot.** The answer is a phone number and a
  promise of a reply within 24 or 48 hours, which is a real cost and should be
  measured as one (enquiries that never get answered are visible in `/admin`).
- **A quotation is a human step in every purchase**, so the desk's response time is
  the conversion rate. That is why the SLA is in the response body, in the
  acknowledgement email and in the access log, rather than in a policy document.

## What would make us revisit this

In rough order of how soon it could happen:

1. **The business approves a published price list.** Without it there is nothing to
   put in a cart. With it, a "buy from your nearest dealer" step is possible before
   a checkout ever is.
2. **A delivery answer for areas the dealers do not cover.** Then a hybrid becomes
   honest rather than opportunistic, starting with the products that do not need
   tinting.
3. **Somebody owns orders.** A named person who answers "where is my paint" and
   processes a refund. Not a rota, not "the team" — a name, because that is what
   roadmap 17.02.12 asks for in every other context.
4. **Demand evidence from the enquiries themselves.** If a meaningful share of
   enquiries are "how do I just buy two litres", the answer is in
   `server/data/quotes.jsonl`, and reading it is a `grep`.

Reversing this decision reverses ADR 0001 as well: orders need a database, a
payment provider, and an operations function. That is not an argument against
reversing it — it is what to budget for when the time comes.
