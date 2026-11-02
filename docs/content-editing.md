# Editing content without touching React

Everything a marketing, technical or commercial colleague needs to change lives
in `app/src/data/`. Each file is a typed list: the editor gets autocomplete and
errors on a typo, and the page that shows the content already exists.

After any change:

```bash
cd app
npm test           # content integrity tests — this is what stops a bad entry
npm run build      # regenerates sitemap.xml from the same data
```

If the tests fail, they name the file and the entry. Do not work around them;
they encode the promise the site makes.

---

## The rules the tests enforce

1. **A digital swatch is an approximation.** Never write copy that says a screen
   colour is an exact match for paint. The colour detail page, the data page and
   every technical sheet already say what the screen cannot show.
2. **No invented prices, testimonials, addresses or dealer names.** The site
   does not publish prices at all — every inquiry path routes to WhatsApp, the
   quote form or a dealer. If another value is a placeholder, it must be marked
   as one (`verified: false`, `claimsStatus: 'pending-verification'`). The UI
   renders those marks.
3. **Codes are permanent.** `OP-001` identifies a colour in saved projects,
   dealer references and printed fan decks. Renaming a code breaks links.
4. **Every image needs alt text.** Add it to `ALT` in `app/src/lib/media.ts` at
   the same time as the image; the tests fail on a missing or placeholder alt.
5. **Claims come from the label or the data sheet.** Product features,
   coverage, dry times and guarantee lengths are transcribed, not estimated.
6. **A tool must cite real records.** The finish finder and the preparation
   advisor reference products and guides by id; `scripts/advisor.test.ts` fails
   if any id does not exist, if a sequence has fewer than three steps, or if a
   step's explanation is too short to be one.
7. **No price or stock claim in structured data.** The route render test fails
   the build if any page emits `offers`, `price`, `lowPrice`, `highPrice`,
   `priceCurrency` or `availability` inside JSON-LD. Search engines print those
   figures into rich results as though the business had said them.

---

## Colours — `app/src/data/colors.ts`

```ts
c({
  id: 'palm-shadow',          // URL: /colours/palm-shadow — lowercase, hyphenated
  code: 'OP-209',             // printed on the fan deck — permanent
  name: 'Palm Shadow',
  hex: '#6E7F63',             // what the interface paints — six digits, uppercase
  family: 'Green',
  undertone: 'Cool',
  rooms: ['Living', 'Exterior'],
  collection: 'The Delta Edit',
  note: 'One or two sentences on how it behaves in a real room.',
})
```

Adding one entry gives you, automatically: the colour in the explorer and all
filters, its own page, sitemap entry, room preview list, calculator links,
`/colours/<id>` deep links, and any palette that references the id.

`measuredLrv` is optional. LRV is estimated from the hex until a
spectrophotometer reading of a dried film exists; supply it and the interface
prefers the measured number everywhere.

## Palettes — `palettes.ts`

Editorial colour stories. `colors` and `roles` are parallel arrays (one role per
colour), and every id must exist in `colors.ts`. `image` must be a key from the
media manifest.

## Products — `products.ts`

The `packs` array drives the calculator and the pack-size display. There is no
price field — the site does not publish prices; every pack-size and estimate
surface links to WhatsApp or the quote form instead.

- `inStock` is deliberately not a stock system: leave `false` unless the
  commercial team confirms availability.
- `coveragePerUnit` is square metres per litre (or kg) for **one coat** on a
  sound, sealed surface. The calculator multiplies by coats.
- `claimsStatus` is `'label-verified'` only when the wording is transcribed from
  a physical pail; otherwise `'pending-verification'` and the page says so.

Technical and safety data sheets are generated, not uploaded: edit
`tools/build-documents.py` and run `python3 tools/build-documents.py`. The PDFs
in `app/public/documents/` are then regenerated for every product, and the tests
check that every `tds` link resolves to a real PDF.

## Dealers — `dealers.ts`

Every entry carries `verified`. `verified: false` renders a "call ahead" note
rather than a confident pin, because sending a customer across Port Harcourt to an empty
shelf costs more than an honest phone number. Replace this file with the
commercial team's export, set `verified: true` only for confirmed stock, and the
state/service filters and distance sort update themselves.

## Guides — `guides.ts`

Each guide needs `sections` (at least three, each with paragraphs), a named
`reviewer`, an `updated` date, a `hero` image key, and at least one
`relatedColors` or `relatedProducts` entry — a guide that does not end in an
action is not published.

## Projects — `projects.ts`

`stage` is `'completed' | 'in progress' | 'concept'`. Anything sourced from a 3D
render **must** be `kind: 'Concept design'`; the tests fail if a render is filed
as completed site work. Client names stay withheld; locations are city/estate
level only.

---

## Preparation and finish advice — `app/src/data/tools.ts`

The two decision-support tools are driven from this file, not from prose in a
component, so advice can be edited without touching React.

- **`PREP_SITUATIONS`** — one entry per situation a visitor can be standing in
  front of. `id` is permanent (it is used in `/tools/surface-prep?situation=<id>`
  and in shared project links). `signs` are how they recognise it, `surfaces`
  where it turns up, `steps` the sequence **in the order the work happens**,
  `products` the product ids in the order they are used, `guides` the guide ids
  that carry the reasoning, and `warnings` the hard stops — what paint cannot
  fix. `condition` maps the situation onto the finish finder's condition answer
  so the two tools cannot disagree.
- **`SURFACE_OPTIONS`, `CONDITION_OPTIONS`, `WEAR_OPTIONS`, `SHEEN_OPTIONS`** and
  **`FINISH_QUESTIONS`** — the four questions and their answers. Each option needs
  a `note` in plain language; each question needs a `why`, because the tools
  explain themselves the way the calculator shows its arithmetic.
- **`TOOL_CARDS`** — the hub at `/tools`. `roadmap` lists the task ids the tool
  answers, which is what makes the scope claim checkable.
- **The recommendation logic itself** lives in `app/src/lib/advisor.ts` as an
  explicit `RULES` table: a predicate, a product, a weight and the sentence that
  explains it. Editing advice means editing that table, and every rule that fires
  contributes a reason the visitor sees. Do not replace it with a score nobody
  can read — the roadmap gates a learned recommender (11.02.07) on validating its
  utility and safeguards first.

Where the honest answer is "paint cannot fix this", the tool says so and
recommends nothing: a damp wall returns `blocked` with the guide that explains
what to do instead. Keep that behaviour. It is the one answer that loses the
sale, and the reason the rest of the advice can be trusted.

## The colour index the service searches

`server/colour-index.json` is **generated**, not edited:

```bash
cd app && npm run index:colours    # or just npm run build
```

It is what `GET /api/search/colours` reads at runtime, because the deployed
container has no TypeScript sources to parse. Edit `colors.ts`, regenerate, and
commit both — `scripts/data.test.ts` compares the index against the library
entry by entry and fails on drift, and CI compares the committed file byte for
byte.

## Adding a photograph

1. Drop the original into `opuda/` with a descriptive name.
2. Add it to `CATALOGUE` in `tools/build-media.py` with a key, crop notes and alt
   text intent.
3. `python3 tools/build-media.py` — writes WebP (1500 px + 640 px), a tint, a
   low-quality placeholder and updates `manifest.json`.
4. Add the alt text to `ALT` in `app/src/lib/media.ts`, and use the key in a
   page.
5. `npm test` — fails if the image is unused or the alt text is missing.

View the generated WebP before publishing: a wrong crop once produced a building
photo filed as a paint pail.
