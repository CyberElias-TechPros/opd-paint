# The printed colour book

`app/public/documents/opudas-colour-book.pdf` — A5 portrait, 32 pages, saddle
stitched. It is the brochure a dealer hands across the counter, and it is
**generated**, not laid out by hand.

```
python3 tools/build-brochure.py        # needs fpdf2, fonttools, brotli, Pillow
```

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
