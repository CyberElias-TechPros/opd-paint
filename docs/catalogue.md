# The master catalogue

`app/public/documents/opudas-catalogue.pdf` — A4 portrait, 126 pages, generated
by `tools/build-catalogue.py`.

This is not an eighth document written from scratch. It is every other printed
document OPUDA'S PAINT publishes, bound into one file, plus a chapter that does
not exist anywhere else: every real site photograph on file, restored for
print and laid out one project per page.

| Section | Source | Format | Pages |
| --- | --- | --- | --- |
| 01 Colour Book | `opudas-colour-book.pdf`, reproduced in full | A5 portrait | 32 |
| 02 Room Book | `opudas-room-book.pdf`, reproduced in full | A5 portrait | 20 |
| 03 Complete Site Gallery | new — every project in `app/src/data/projects.ts` | A4 portrait | 20 |
| 04 Colour Wheel | `opudas-colour-wheel.pdf`, reproduced in full | A4 portrait | 3 |
| 05 Specification Sheet | `opudas-spec-sheet.pdf`, reproduced in full | A4 landscape | 2 |
| 06 Fan Deck | `opudas-fan-deck.pdf`, reproduced in full | A4 portrait | 19 |
| 07 Technical & Safety Data Sheets | all twelve `opudas-*-tds.pdf` / `opudas-*-sds.pdf`, grouped by product | A4 portrait | 20 |

Plus a cover, a contents page, one divider per section and a back cover: 126
pages in total. The contents page states each section's starting page number,
computed from the real page counts of the files being bound — if a source
document grows or shrinks, the catalogue's own page numbers move with it
without anyone having to edit a number by hand.

## Why a merge, not a rewrite

Each of the six bound-in documents is the one source of truth for its own
numbers — coverage rates, cure times, LRVs, the colour library. Re-deriving
that content a second time inside the catalogue would risk it disagreeing with
the document it was copied from, probably years later after only one of the
two was edited. Instead `build-catalogue.py` runs the other six generators
itself at the start of every build, then uses `pypdf` to copy their actual
output pages into the merged file behind new cover, contents, divider and
gallery pages of its own. The catalogue can never be built from a stale PDF,
and it can never disagree with the document it reproduces, because it *is*
that document's own pages.

The one new piece of content is the Complete Site Gallery (section 03): one
page per entry in `app/src/data/projects.ts`, in the order the data file
carries them, each with its photographs, its colour chips (where a verified
job sheet exists — several entries deliberately carry none), its takeaway line
and as much of its "story" prose as fits the page without a paragraph being
cut off partway through. A project recorded with `stage: 'concept'` is
labelled **CONCEPT RENDER** on its page — it is architectural artwork, not a
site photograph, and the catalogue says so rather than letting it pass as one.

## The photographs, restored for print

The web site serves these same images as WebP at screen resolution, sized for
a fast page load. `build-catalogue.py` decodes the original files again and
restores them for print before placing them:

1. `ImageOps.autocontrast(cutoff=1)` — recovers the tonal range a phone
   camera's JPEG encoder and a WhatsApp re-compression both flatten.
2. A small, fixed lift in colour, contrast and brightness
   (`ImageEnhance.Color(1.12)`, `Contrast(1.08)`, `Brightness(1.02)`).
3. One `ImageFilter.UnsharpMask` pass, to restore edge definition lost to
   compression.
4. Re-encoded at 220 ppi at the size it is actually placed, rather than the
   ~200 ppi the other documents use — this chapter's photographs are the
   largest images in the whole library.

The amounts are small, fixed and applied identically to every photograph —
the point is to look like clean print, not an edited one. Nothing here claims
a photograph shows an exact paint colour: the same disclaimer that closes
every colour page in this file closes this one too.

## Reproducibility

Byte-stable, like every other generated asset here. `tools/build-catalogue.py`
pins the same creation date the other generators use, and sets the merged
file's `/CreationDate`, `/ModDate` and `/ID` explicitly rather than letting
`pypdf` pick a value when it writes — `pypdf`'s own identifier is a checksum of
the file's content, not the clock, so two builds from identical source
documents produce identical bytes. `tools/check-assets.py` treats this PDF
like any other committed artefact for exactly that reason.

## Run it

```
python3 tools/build-catalogue.py
```

Needs fpdf2, fonttools, brotli, Pillow and `pypdf` — the same set the other
document generators need, plus `pypdf` for the merge. This script also
regenerates the colour book, room book, colour wheel, specification sheet, fan
deck and all twelve data sheets itself before binding them, so it needs
everything `build-documents.py`, `build-fandeck.py`, `build-brochure.py`,
`build-roombook.py`, `build-colorwheel.py` and `build-specsheet.py` need too.

## Mixed page sizes

The cover, contents, dividers and gallery are A4 portrait; the colour book and
room book keep their own A5 trim; the specification sheet keeps its A4
landscape trim. The contents page states each section's format next to its
page count, so nobody printing this file is surprised by a page rotating
partway through — it is a bound set of several print products, not a single
one pretending to be homogeneous.
