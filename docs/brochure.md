# The printed library

Four documents, every one **generated** from the same data as the website, not
laid out by hand:

| Document | File | Format | Organised by |
| --- | --- | --- | --- |
| Colour Book | `app/public/documents/opudas-colour-book.pdf` | A5, 32 pp | colour — nine families, 59 colours, 8 palettes |
| Room Book | `app/public/documents/opudas-room-book.pdf` | A5, 20 pp | the job the colour has to do — four methods, sixteen colourways |
| Colour Wheel | `app/public/documents/opudas-colour-wheel.pdf` | A4, 3 pp | a single-sheet quick reference — the wheel, the full swatch grid, the library |
| Specification Sheet | `app/public/documents/opudas-spec-sheet.pdf` | A4 landscape, 2 pp | the six products, by the surface they go on |

The fan deck (`tools/build-fandeck.py`) and the twelve technical and safety
data sheets (`tools/build-documents.py`) are not in that table — they predate
it and are documented at the top of their own scripts. All of it, these four
plus the fan deck plus every data sheet, is also bound into one file: see
[catalogue.md](catalogue.md) for the master catalogue, which additionally adds
a chapter of restored site photography that exists nowhere else. It is a
different enough object — a merge of PDFs, not a drawing of one — to document
on its own.

This document covers the two books in detail, with their own sections below.
The Colour Wheel and Specification Sheet are shorter, so they get a single
section each near the end instead.

```
python3 tools/build-brochure.py       # Colour Book
python3 tools/build-roombook.py       # Room Book
python3 tools/build-colorwheel.py     # Colour Wheel
python3 tools/build-specsheet.py      # Specification Sheet
```

All four need fpdf2, fonttools, brotli and Pillow.

The same four Python packages the other document generators need. CI pins their
versions and rebuilds every committed artefact, so a library bump that changes
the bytes shows up as a failing check rather than as a mystery diff.

## What is in it

| Pages | Contents |
| --- | --- |
| 1 | Cover — the whole library as fifty-nine painted stripes |
| 2 | A real Port Harcourt job, full bleed, and the colophon |
| 3 | Contents |
| 4 | How to read a colour: the code, the family, the undertone, the LRV — and what the book cannot do |
| 5 | The argument: colour has a job to do |
| 6–23 | Nine family chapters. Each opens on a full page of the family's lead colour with the idea behind it, then shows the range with codes, LRVs, undertones and hex |
| 24–26 | Eight palettes, with a role for every wall |
| 27 | Three jobs on the wall, with the palette specified for each |
| 28 | One colour, four lights — why a colour chosen at noon can feel wrong at dinner |
| 29 | Specification: finish, coverage and packs per product, and the arithmetic for sizing a job |
| 30 | Where to start, and where to buy |
| 31 | Colours by room — the same library indexed the other way round |
| 32 | Back cover |

PDF bookmarks follow the same structure, because the same file ends up on a
dealer's phone.

## Where every figure comes from

Nothing in the book is transcribed. Each number is read at build time from the
file that also serves the website:

| In the book | Read from |
| --- | --- |
| Colour names, codes, hex, family, undertone, room tags | `app/src/data/colors.ts` |
| Palettes, roles, palette stories | `app/src/data/palettes.ts` |
| Job titles, locations, years, covers, specified colours | `app/src/data/projects.ts` |
| Finish, coverage, pack sizes, product names | `tools/build-documents.py` (imported, not copied) |
| Phone number | `app/src/data/dealers.ts` |
| LRV | Calculated from the hex, with the same formula the site uses |

If the site drops a colour, the book drops it. If a code changes, the book
changes. That is the whole point of generating it: a printed catalogue is the
most expensive place in the business to be wrong, and the hardest to correct.

The prose — chapter essays, craft notes, the honesty panel — lives in
`tools/brochure_copy.py`, apart from the drawing code, so writing can be edited
without reading Python.

## The rules the copy follows

* No price, no guarantee, no testimonial. Those live in data with a provenance
  flag and are not published here.
* Nothing about a colour a painter could not verify on a wall. Perceptual effects
  (red advances, green darkens on four walls) are stated as guidance.
* The colour-accuracy disclaimer appears three times — inside the cover, in the
  how-to-read panel, and on the back — because a printed approximation of a
  digital value is exactly what it says it is.
* Room tags are described as tags, and the photograph caption says which colours
  the *job record* specifies, not which colours are in the frame. Those are
  different claims and the second one the picture can disprove.

## Printing it

* **Trim size** A5 148 × 210 mm. The PDF is trim size, with no bleed and no crop
  marks. Everything full-bleed is a solid field of colour, so if your printer
  wants 3 mm bleed, ask them to extend the fields — nothing with type in it
  crosses the trim.
* **Type safety** The smallest type is 5.4 pt and every text block sits at least
  11 mm from the trim edge.
* **Ink** The swatches are specified as RGB. For litho, convert to your house CMYK
  profile and proof the nine family openers, which are the pages most likely to
  shift. The book says on every copy that a printed chip is not a paint film, so
  a small shift is honest — but a red that turns orange is not.
* **Paper** Uncoated text stock reads closer to a paint film than gloss does, and
  it is what the reference brochures in this market use.
* **Binding** 32 pages is one 16-page signature; saddle stitch, two staples.

## Reproducibility

Two builds from identical source produce identical bytes. Three things make that
true, and each has a comment where it is implemented:

1. The PDF creation date is pinned (and `SOURCE_DATE_EPOCH` overrides it).
2. `head.modified` is pinned in every embedded font, because fontTools stamps the
   current time on save and would change the font stream — and therefore the
   whole file — on every build.
3. Photographs are decoded, cropped, resampled and re-encoded at one fixed
   quality through Pillow, whose version CI pins.

`tools/check-assets.py` compares the committed PDF byte for byte, so a change to
the book is always a change someone made on purpose.

## Editing it

| To change | Edit |
| --- | --- |
| Any sentence of editorial copy | `tools/brochure_copy.py` |
| A colour, code or family | `app/src/data/colors.ts` (the site changes too — that is intended) |
| A product's coverage or packs | `tools/build-documents.py` (the data sheets change too) |
| Type scale, margins, colour tokens | the constants at the top of `tools/build-brochure.py` |
| Which jobs appear on page 27 | the `picks` list in `main()` |

Then rebuild and commit the PDF with the change. A build that has drifted will
fail the assets check, which is how this stays true.

## One thing to check before a print run

The photographs on page 27 are the site's own job photography, cropped to the
page. They are documentary — a wall being painted, a finished facade — which is
the honest thing for this brand, but it is not the aspirational interior
photography the mass-market brochures use. If a print run is going to a dealer's
counter, walk through the eight palettes and confirm each one has a photograph
that shows the finished colours it names.


---

# The Room Book

`app/public/documents/opudas-room-book.pdf` — 20 pages. The second volume of the
same library, indexed the other way round: instead of "which colours are there",
it answers "which surface is this, and what should it be".

```
python3 tools/build-roombook.py
```

## What is in it

| Pages | Contents |
| --- | --- |
| 1 | Cover — one real room with one wall repainted |
| 2 | The argument: a colour is not a scheme, and the two volumes |
| 3–4 | Contents, and how to read a plate |
| 5–8 | **01 Aperture** — the wall the light comes from, shown on the bedroom at Rumuokoro |
| 9–12 | **02 Substrate** — when the surface is the problem, shown on the GRA Phase 2 feature wall |
| 13–16 | **03 Threshold** — boundary walls and plinths, shown on the GRA Phase 2 villa |
| 17–20 | **04 Depth** — ironwork and frames, shown on the Rumuola gate |
| 21 | The four collections, with counts generated from the data |
| 22 | Which surface takes which method |
| 23 | The order to decide in |
| 24 | Back cover |

Each method gets three pages: an opening page of the method's lead colour with the
problem and the principle, a colourways page with three renders, and a page
showing the **untouched photograph** beside exactly what was and was not altered.

## How a plate is made

This is the part worth reading before editing anything.

A painted wall in a photograph is, to a good approximation, its *reflectance
multiplied by the light falling on it*. So for each wall plane the builder:

1. traces a clip polygon around the plane, in fractions of the image
   (`tools/roombook-plates.json`);
2. flood-fills from seeds inside that clip with a colour tolerance, so the edge
   follows the cornice, the socket and the shadow rather than a straight line;
3. takes the photograph's luminance inside the mask, divides by its own mean and
   clamps the ratio;
4. multiplies the chosen paint by that ratio.

Step 3 is what makes it believable and honest. A plain `color` blend keeps every
photographic highlight, which turns Atlantic Blue into a pastel on a bright
facade; a flat fill throws away the modelling. Scaling by the wall's *own*
luminance keeps both, and because it is mean-preserving the rendered colour at
mid-wall is the paint — the build asserts this.

The plates are the masks that survived review. A plane whose flood fill leaked
into a neighbouring surface was either re-traced with a tighter clip or dropped,
because a mask that catches a door frame looks like a mistake in print, at
300 dpi, in front of a customer.

**If a mask ever comes out empty, the build stops.** A silently unpainted wall is
worse than a failed build.

## Adding a plate

1. Choose a photograph in `app/public/media` that shows a wall with a clear
   boundary — a finished room, a facade, a gate.
2. Put a 100-pixel grid over it and trace the wall plane as fractions of the
   image.
3. Add an entry to `tools/roombook-plates.json`: clip polygon, seeds (pixel
   coordinates inside the wall), tolerance.
4. Build, render the affected pages, and look at them. If the fill crosses an
   edge, tighten the clip. If it misses the plane, raise the tolerance.
5. Add the plate key to a method in `tools/roombook_copy.py`, and give every
   scheme one colour per plane.

Schemes may also carry `pair`: extra colours shown as chips only. A chip is a
claim about paint; a render is a claim about a photograph, and the book only
makes it for surfaces it actually repainted.

## The honest limits

- **Nowhere does it claim a styled set.** There are no prop-and-cushion spreads,
  because OPUDA'S has not photographed any and the book will not pass a stock
  image off as one. Every plate is a real site, warts and all.
- **A repainted photograph cannot model** the sheen of a finish at a grazing
  angle, how an emulsion covers a patch, or the light at eight in the evening.
  The book says so on the how-to-read page and again on the back.
- **Coverage is printed.** Each plate page states what percentage of the frame
  was repainted, so the reader can see how much of the image is a decision and
  how much is a photograph.

## Print

Same trim, margins and type sizes as the Colour Book — the geometry, tokens,
type scale and helper functions are **imported** from `build-brochure.py`, not
copied. Two documents whose margins drift apart are two documents that look like
two companies.

Universal process, 40 pages would be a signature; at 20 it is a saddle stitch.
The plate pages are photographic, so proof those first, not the swatches.

---

# The Colour Wheel

`app/public/documents/opudas-colour-wheel.pdf` — 3 pages, A4 portrait. Not a
book: a single-sheet reference, the thing pinned to a board at a trade counter
rather than read cover to cover.

```
python3 tools/build-colorwheel.py
```

## What is on it

| Page | Contents |
| --- | --- |
| 1 | The wheel — all 59 colours as one ring, grouped into the nine families, each family's share of the ring proportional to how many colours it has |
| 2 | The full swatch grid — every colour, code and name, grouped the same way as the wheel |
| 3 | The rest of the library (Colour Book, Room Book, Fan Deck) and the trade counter contact block |

The wheel is a map of the library, not a mixing wheel or a colour-theory
diagram: wedge width follows family size, and colours within a family run
lightest to darkest working outward from the top. It makes no claim about which
colours harmonise — that is what the palettes in the Colour Book are for.

## The one thing worth knowing if you touch the geometry

fpdf2's `solid_arc(x, y, a, start_angle, end_angle, b, ...)` takes `x, y` as the
**upper-left corner of the bounding box**, and `a`/`b` as its **diameters** —
despite a docstring that calls them semi-axes. It forwards straight to `arc()`,
which halves them. So a circle of radius `r` centred on `(cx, cy)` needs
`x = cx - r, y = cy - r, a = b = 2r`. Get this wrong and the wheel renders as a
correctly-shaped circle in entirely the wrong place, which is a much more
confusing bug to read than it is to avoid.

The angle convention is also not the compass bearing you would guess: `0°`
points to the right (3 o'clock) and increasing the angle sweeps clockwise on
the page by default. The wheel wants "0 at the top, clockwise", so every angle
passed to `solid_arc` is `270 + degrees_clockwise_from_top`.

---

# The Specification Sheet

`app/public/documents/opudas-spec-sheet.pdf` — 2 pages, A4 landscape. The
Berger- and Smart-Paints-style trade sheet: every product's finish, coverage,
timing and surfaces on one sheet, instead of six separate technical data
sheets.

```
python3 tools/build-specsheet.py
```

## What is on it

| Page | Contents |
| --- | --- |
| 1 | The six products grouped by where they go — interior, exterior, wood & metal, preparation — with their headline claims, coverage and a status chip |
| 2 | One table with every figure for every product (finish, surfaces, coverage, coats, touch-dry, recoat, cure, guarantee), dilution and VOC notes, and the coverage calculator |

Every figure comes from the same `PRODUCTS` dictionary that builds the six
TDS/SDS documents (`tools/build-documents.py`) — nothing on this sheet is typed
a second time. The status chip on each product (`Label-verified` /
`Pending verification`) is read directly from `claimsStatus` in
`app/src/data/products.ts`, so a product cannot show a confidence the site
itself does not claim.

## Why it exists

Looking at Asian Paints' and Berger's trade literature side by side with
OPUDA'S's own documents turned up a gap: a dealer or contractor who wants "all
six products, compared, on one sheet" had nowhere to go except six separate
PDFs. The Colour Book's own specification page (`Book.specification()`) answers
a narrower question — coverage and packs only, for a reader who already has the
book in hand. This sheet answers the fuller one, standalone.

## The honest limits

- **No certifications are claimed that OPUDA'S does not hold.** Berger's
  reference lists ISO 9001, ISO 14001 and BizSafe; Smart Paints' lists a page of
  eco marks. OPUDA'S has none of these on record, so none appear here — the
  status chip is the only form of assurance language the sheet uses, and it is
  honest about which claims are still awaiting sign-off.
- **No founding date, plant description or "top 10 in Asia" framing.** Both
  references open with a company-credentials page; OPUDA'S has no verified
  facts of that kind yet; inventing them was not an option.
