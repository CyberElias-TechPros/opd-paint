#!/usr/bin/env python3
"""
Build the room-scheme book: `app/public/documents/opudas-room-book.pdf`.

The second volume of the colour library. Where the Colour Book is indexed by
colour, this one is indexed by the job the colour has to do: four methods
(Aperture, Substrate, Threshold, Depth), each with colourways rendered onto
OPUDA'S's own site photographs.

Everything that can be shared with the Colour Book is imported from it rather
than copied — page geometry, type scale, the label and paragraph helpers, the
thumb index, the house mark. That is deliberate: two documents whose margins
drift apart are two documents that look like two companies.

Same reproducibility contract as its sibling: pinned creation date, pinned font
timestamps, fixed JPEG quality, fixed crop, deterministic masks. CI rebuilds it
and compares the bytes.

Run:  python3 tools/build-roombook.py
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"

sys.path.insert(0, str(TOOLS))

import brochure_copy as book_one  # noqa: E402  (reused for the two-volume note)
import roombook_copy as copy  # noqa: E402
import roombook_plates as plates_module  # noqa: E402

OUT = ROOT / "app" / "public" / "documents" / "opudas-room-book.pdf"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# The Colour Book's builder is a script, not a library, but its `Book` class is
# exactly the layout engine this document needs. Importing it keeps one definition
# of every margin, rule and type size in the repository.
bb = _load("build_brochure", TOOLS / "build-brochure.py")

# The Colour Book module exports its tokens as bare names (`INK`, `PAPER`); this
# file refers to them as `bb.C_INK` so a reader can tell at a glance that a colour
# came from the shared token set rather than from a literal in this file.
for _name in ("INK", "INK_SOFT", "MOSS", "GREEN", "GREEN_DEEP", "CRIMSON", "ORANGE",
              "PAPER", "PAPER_2", "PLASTER", "LINE", "LINE_MID"):
    setattr(bb, f"C_{_name}", getattr(bb, _name))


class RoomBook(bb.Book):
    def __init__(self, plates):
        colours = bb.read_colours()
        super().__init__(
            colours,
            bb.by_family(colours),
            bb.read_palettes(),
            bb.read_projects(),
            bb.read_products(),
            bb.read_phone(),
        )
        self.plates = plates
        self.set_title("OPUDA'S PAINT — Room Book 2026")
        self.set_subject(
            "Four methods and sixteen colourways, rendered on OPUDA'S's own site photographs"
        )
        self.set_keywords("paint, colour scheme, room colour, Port Harcourt, colourways")

    def header(self) -> None:
        """Its own running head. The inherited one says Colour Book."""
        self.fill(0, 0, bb.PAGE_W, bb.PAGE_H, self.background)
        if not self.chrome:
            return
        self.thumb_index(self.active_family)
        self.label(f"{copy.BRAND} · Room book", x=bb.LIVE_X, y=10.6, colour=bb.MOSS,
                   size=5.5, track=0.14)
        self.label(self.section, x=bb.LIVE_X + 44, y=10.6, colour=bb.INK_SOFT, size=5.5,
                   track=0.14)
        self.font("Sans", 6.0, bb.INK)
        self.set_xy(bb.LIVE_R - 14, 10.6)
        self.cell(14, 2.2, f"{self.page_no():02d}", align="R")
        self.rule(bb.LIVE_X, 14.4, bb.LIVE_W)

    def thumb_index(self, active: str | None) -> None:
        """
        The fore-edge index, one block per method.

        The Colour Book indexes nine colour families; this book is organised by the
        job the colour has to do, so the rail is four blocks and the active method's
        block extends. A rail that indexes something the book is not organised by
        would be decoration.
        """
        segment = bb.PAGE_H / len(copy.METHODS)
        for index, method in enumerate(copy.METHODS):
            lead = self.by_id[method["schemes"][0]["colors"][0][0]]["hex"]
            is_active = method["name"] == active
            width = 7.2 if is_active else 4.2
            x = bb.PAGE_W - width
            self.fill(x, index * segment, width, segment, bb.rgb(lead))
            if is_active:
                self.set_draw_color(*bb.PAPER)
                self.set_line_width(0.8)
                self.line(x - 0.4, index * segment + 0.4, x - 0.4,
                          (index + 1) * segment - 0.4)
        self.set_draw_color(*bb.LINE)
        self.set_line_width(bb.HAIR)
        self.line(bb.PAGE_W - 4.6, 0, bb.PAGE_W - 4.6, bb.PAGE_H)

    def new_page(self, section: str, active: str | None = None, background=bb.PAPER,
                 chrome: bool = True, note: str | None = None, outline: str | None = None,
                 level: int = 0) -> None:
        super().new_page(section, active=active, background=background, chrome=chrome,
                         note=note, outline=outline, level=level)

    # ---------------------------------------------------------------- cover

    def cover(self) -> None:
        self.section = "Cover"
        self.chrome = False
        self.add_page()
        self.fill(0, 0, bb.PAGE_W, bb.PAGE_H, bb.C_INK)

        # The companion volume's cover is a field of every colour in the library.
        # This one is a single plate: one room, one wall, one decision.
        plate = self.plates["living"]
        image = plate.render(["#1E4E6B"])
        self.image(plates_module.encode(image, bb.PAGE_W, 132.0, focus=0.45), 0, 0, bb.PAGE_W, 132.0)

        self.label(f"{copy.BRAND} · Volume two", x=bb.LIVE_X, y=146, colour=bb.C_PAPER_2,
                   size=6.4, track=0.24)
        self.font("Serif", 40, bb.C_PAPER_2)
        self.set_xy(bb.LIVE_X - 0.6, 152)
        self.cell(bb.LIVE_W, 15, "Room Book")
        self.font("SerifI", 14, bb.C_PAPER_2)
        self.set_xy(bb.LIVE_X, 169)
        self.multi_cell(bb.LIVE_W - 6, 6.0, "Four methods for choosing colour\nby the job it has to do")
        self.rule(bb.LIVE_X, 188, 26, colour=bb.C_PAPER_2, width=0.5)
        self.label(f"{copy.EDITION} · {copy.CITY}", x=bb.LIVE_X, y=192, colour=bb.C_PAPER_2,
                   size=5.9, track=0.18)

    def inside_front(self) -> None:
        self.section = "This book"
        self.chrome = False
        self.add_page()
        self.fill(0, 0, bb.PAGE_W, bb.PAGE_H, bb.C_PAPER)

        self.font("Serif", 30, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.5, 34)
        self.multi_cell(bb.LIVE_W - 6, 11.0, copy.ESSAY_TITLE)
        self.rule(bb.LIVE_X, self.get_y() + 5, 26, colour=bb.C_GREEN, width=0.6)

        y = self.get_y() + 12
        for index, paragraph in enumerate(copy.ESSAY):
            y = self.para(paragraph, bb.LIVE_X, y, bb.LIVE_W - 4, size=9.0, leading=1.62)
            y += 4.4
            if index == 1:
                start = y
                self.font("SerifI", 13.5, bb.C_GREEN)
                self.set_xy(bb.LIVE_X + 7, start)
                self.multi_cell(bb.LIVE_W - 20, 6.2, copy.ESSAY_PULL)
                y = self.get_y() + 4.6
                self.set_draw_color(*bb.C_GREEN)
                self.set_line_width(0.6)
                self.line(bb.LIVE_X + 4.0, start + 0.4, bb.LIVE_X + 4.0, y - 5.8)

        # The two volumes, stated once: the reader may be holding either.
        panel = bb.PAGE_H - 92
        self.fill(bb.LIVE_X, panel, bb.LIVE_W, 52, bb.C_PLASTER)
        self.label("Two volumes", x=bb.LIVE_X + 6, y=panel + 5.6, colour=bb.C_GREEN,
                   size=5.9, track=0.16)
        row = panel + 11.0
        for title, note in copy.VOLUMES:
            self.font("SansSB", 7.6, bb.C_INK)
            self.set_xy(bb.LIVE_X + 6, row)
            self.cell(bb.LIVE_W - 12, 3.2, title)
            self.para(note, bb.LIVE_X + 6, row + 3.8, bb.LIVE_W - 14, size=6.6,
                      colour=bb.C_INK_SOFT, leading=1.4)
            row += 13.0

        self.font("Sans", 5.4, bb.C_MOSS)
        self.set_xy(bb.LIVE_X, bb.PAGE_H - 26)
        self.multi_cell(
            bb.LIVE_W - 16, 2.6,
            "Set in Instrument Serif and Archivo. Plates are OPUDA'S site photographs with a "
            "wall repainted; every colour, code and LRV comes from the data that serves "
            "opudapaint.com.",
        )
        self.font("Sans", 5.4, bb.C_MOSS)
        self.set_xy(bb.LIVE_R - 30, bb.PAGE_H - 11)
        self.cell(30, 3, "02", align="R")

    def contents(self) -> None:
        self.new_page("Contents", outline="Contents")
        self.font("Serif", 33, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.5, 25)
        self.cell(bb.LIVE_W, 11, "Contents")
        self.para(
            "Four methods, then the collections they draw from, then the order to decide in. "
            "Each method is a problem that turns up on almost every job we quote.",
            bb.LIVE_X, 42, bb.LIVE_W - 10, size=8.2, colour=bb.C_INK_SOFT,
        )

        entries = self.plan
        y = 62.0
        for label, title, page in entries:
            self.label(label, x=bb.LIVE_X, y=y + 1.3, colour=bb.C_MOSS, size=5.5, track=0.14)
            self.font("SansSB", 8.2, bb.C_INK)
            self.set_xy(bb.LIVE_X + 14, y)
            self.cell(bb.LIVE_W - 28, 4, title)
            self.font("Sans", 7.8, bb.C_MOSS)
            self.set_xy(bb.LIVE_R - 11, y)
            self.cell(11, 4, f"{page:02d}", align="R")
            self.rule(bb.LIVE_X, y + 5.6, bb.LIVE_W, colour=bb.C_LINE)
            y += 12.4

        self.font("SerifI", 10.0, bb.C_GREEN)
        self.set_xy(bb.LIVE_X, y + 3.0)
        self.multi_cell(bb.LIVE_W - 16, 4.8, "Sixteen colourways on four real Port Harcourt sites.")

    # ---------------------------------------------------------------- how to read

    def how_to_read(self) -> None:
        self.new_page("How to read this book", outline="How to read this book")
        self.font("Serif", 21, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.4, 24)
        self.cell(bb.LIVE_W, 9, copy.HOW_TITLE)
        self.para(copy.HOW_INTRO, bb.LIVE_X, 36, bb.LIVE_W - 8, size=8.0, colour=bb.C_INK_SOFT)

        y = 62.0
        for field, explanation in copy.HOW_FIELDS:
            self.label(field, x=bb.LIVE_X, y=y, colour=bb.C_GREEN, size=5.9, track=0.16)
            y = self.para(explanation, bb.LIVE_X, y + 4.0, bb.LIVE_W - 10, size=7.2,
                          colour=bb.C_INK_SOFT, leading=1.48) + 6.0

        panel = max(y + 2.0, 146.0)
        self.fill(bb.LIVE_X, panel, bb.LIVE_W, 48, bb.C_PLASTER)
        self.label(copy.HONESTY_TITLE, x=bb.LIVE_X + 6, y=panel + 5.6, colour=bb.C_CRIMSON,
                   size=6.0, track=0.14)
        self.para(copy.HONESTY, bb.LIVE_X + 6, panel + 11.4, bb.LIVE_W - 12, size=6.9,
                  colour=bb.C_INK, leading=1.5)

    # ---------------------------------------------------------------- method chapters

    def method_opener(self, method: dict) -> None:
        lead = self.by_id[method["schemes"][0]["colors"][0][0]]["hex"]
        text = bb.on_colour(lead)
        self.new_page(f"{method['number']} · {method['name']}", active=method["name"],
                      background=bb.rgb(lead), chrome=False,
                      outline=f"{method['number']} {method['name']} — {method['headline']}")

        self.label(method["name"], x=bb.LIVE_X, y=14, colour=text, size=6.0, track=0.20)
        self.label("Method " + method["number"], x=bb.LIVE_R - 80, y=14, colour=text,
                   size=6.0, track=0.18)

        ghost = bb.blend(lead, "#{:02X}{:02X}{:02X}".format(*text), 0.17)
        self.font("Serif", 118, bb.rgb(ghost))
        self.set_xy(bb.LIVE_R - 56, 84)
        self.cell(58, 48, method["number"], align="R")

        self.font("Serif", 27, text)
        self.set_xy(bb.LIVE_X - 0.5, 33)
        self.multi_cell(bb.LIVE_W - 6, 10.0, method["headline"])
        self.font("SerifI", 11.5, text)
        self.set_xy(bb.LIVE_X, self.get_y() + 2.4)
        self.multi_cell(bb.LIVE_W - 20, 5.0, method["subtitle"])
        rule_y = self.get_y() + 5.4
        self.rule(bb.LIVE_X, rule_y, 22, colour=text, width=0.45)

        self.para(method["problem"], bb.LIVE_X, rule_y + 8.6, bb.LIVE_W - 14, size=8.4,
                  colour=text, leading=1.58)

        base = bb.PAGE_H - 62
        muted_line = bb.rgb(bb.blend(lead, "#{:02X}{:02X}{:02X}".format(*text), 0.22))
        self.rule(bb.LIVE_X, base - 8, bb.LIVE_W, colour=muted_line)
        self.label("The principle", x=bb.LIVE_X, y=base, colour=text, size=5.9, track=0.16)
        self.para(method["principle"], bb.LIVE_X, base + 4.2, bb.LIVE_W - 8, size=8.2,
                  colour=text, leading=1.5)

        self.font("Sans", 5.6, bb.rgb(bb.blend(lead, "#{:02X}{:02X}{:02X}".format(*text), 0.5)))
        self.set_xy(bb.LIVE_X, bb.FOOT_TEXT)
        self.cell(bb.LIVE_W * 0.6, 3, f"{copy.EDITION} edition")
        self.set_xy(bb.LIVE_R - 32, bb.FOOT_TEXT)
        self.cell(32, 3, copy.CITY, align="R")

    def scheme_page(self, method: dict, schemes: list[dict], part: int, parts: int) -> None:
        plate = self.plates[method["plate"]]
        self.new_page(f"{method['name']} · plates", active=method["name"],
                      note="A repainted photograph, not a styled set.")
        self.font("Serif", bb.T_TITLE, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.3, 21)
        self.cell(bb.LIVE_W - 40, 7, "Colourways")
        self.label(f"{plate.title}", x=bb.LIVE_R - 60, y=24, colour=bb.C_MOSS, size=5.5,
                   track=0.08)
        if parts > 1:
            self.label(f"plate {part} of {parts}", x=bb.LIVE_R - 24, y=32,
                       colour=bb.C_MOSS, size=5.5, track=0.10)

        row_height = 40.0
        plate_w = 62.0
        for index, scheme in enumerate(schemes):
            y = 34.0 + index * (row_height + 8.4)
            hexes = [self.by_id[colour_id]["hex"] for colour_id, _role in scheme["colors"]]
            image = plate.render(hexes)
            self.image(plates_module.encode(image, plate_w, row_height, focus=0.45),
                       bb.LIVE_X, y, plate_w, row_height)
            self.outline(bb.LIVE_X, y, plate_w, row_height, colour=bb.C_LINE, width=bb.HAIR)

            x = bb.LIVE_X + plate_w + 5.4
            self.font("Serif", 12.5, bb.C_INK)
            self.set_xy(x, y - 0.6)
            self.cell(bb.LIVE_W - plate_w - 5.0, 5, scheme["name"])

            row = y + 5.4
            for colour_id, role in scheme["colors"]:
                colour = self.by_id[colour_id]
                self.fill(x, row, 4.6, 4.6, bb.rgb(colour["hex"]))
                self.outline(x, row, 4.6, 4.6, colour=bb.C_LINE, width=bb.HAIR)
                self.font("SansSB", 6.1, bb.C_INK)
                self.set_xy(x + 6.4, row)
                self.cell(bb.LIVE_W - plate_w - 12, 2.6, colour["name"])
                self.font("Sans", 5.6, bb.C_MOSS)
                self.set_xy(x + 6.4, row + 2.6)
                self.cell(bb.LIVE_W - plate_w - 12, 2.4,
                          f"{colour['code']} · LRV {colour['lrv']} · {role}")
                row += 9.0

            note_y = row + 0.6
            if scheme.get("pair"):
                # Paired colours are an editorial suggestion for the surfaces this
                # plate does not show. Chipped, never rendered — a chip is a claim
                # about paint, and a render would be a claim about a photograph.
                self.label("pair with", x=x, y=note_y, colour=bb.C_MOSS, size=5.2, track=0.12)
                chip_x = x + 15.0
                for colour_id in scheme["pair"]:
                    colour = self.by_id[colour_id]
                    self.fill(chip_x, note_y - 1.6, 3.6, 3.6, bb.rgb(colour["hex"]))
                    self.outline(chip_x, note_y - 1.6, 3.6, 3.6, colour=bb.C_LINE, width=bb.HAIR)
                    self.font("Sans", 5.2, bb.C_MOSS)
                    self.set_xy(chip_x + 4.4, note_y - 1.2)
                    self.cell(22, 2.4, colour["code"])
                    chip_x += 26.0
                note_y += 5.0
            self.para(scheme["note"], x, note_y, bb.LIVE_W - plate_w - 6, size=6.4,
                      colour=bb.C_INK_SOFT, leading=1.4)

        # The method's principle repeated where it is needed — at the plate.
        note_y = bb.PAGE_H - 40
        self.rule(bb.LIVE_X, note_y, bb.LIVE_W, colour=bb.C_LINE)
        self.para(method["principle"], bb.LIVE_X, note_y + 3.4, bb.LIVE_W - 8, size=6.6,
                  family="SerifI", colour=bb.C_MOSS, leading=1.45)

    def plate_notes(self, method: dict) -> None:
        """One page per method: what the plate is, and what it cannot show."""
        plate = self.plates[method["plate"]]
        self.new_page(f"{method['name']} · the plate", active=method["name"],
                      outline=f"{method['name']} — the plate")
        self.font("Serif", bb.T_TITLE, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.3, 21)
        self.cell(bb.LIVE_W, 7, "The plate")

        self.font("Serif", 13, bb.C_INK)
        self.set_xy(bb.LIVE_X, 34)
        self.cell(bb.LIVE_W - 20, 5.4, plate.title)
        self.font("Sans", 6.6, bb.C_MOSS)
        self.set_xy(bb.LIVE_X, 40)
        planes = len(plate.planes)
        self.cell(bb.LIVE_W - 20, 3,
                  f"{planes} repaintable plane{'s' if planes > 1 else ''} · {plate.note.lower()}")

        # The untouched photograph, so a reader can see exactly what was altered.
        self.image(plates_module.encode(plate.image, bb.LIVE_W, 74.0, focus=0.45),
                   bb.LIVE_X, 48, bb.LIVE_W, 74.0)
        self.outline(bb.LIVE_X, 48, bb.LIVE_W, 74.0, colour=bb.C_LINE, width=bb.HAIR)
        self.font("Sans", 6.0, bb.C_MOSS)
        self.set_xy(bb.LIVE_X, 123.4)
        self.cell(bb.LIVE_W, 2.6, "The photograph as taken. Every plate in this chapter starts from this frame.")

        rows = [
            ("Repainted", ", ".join(plane["name"].lower() for plane in plate.planes)),
            ("Left alone", "Floors, ceilings, joinery, furniture, sky and every other surface in the frame"),
            ("How", "The wall's own luminance normalised against its mean, then multiplied by the "
                    "chosen paint — so shadows, corners and highlights survive"),
            ("Shared", f"{', '.join(str(c) + '%' for c in plate.coverage)} of the frame is repainted; "
                       "nothing else is touched"),
        ]
        y = 132.0
        for label, value in rows:
            self.label(label, x=bb.LIVE_X, y=y, colour=bb.C_GREEN, size=5.8, track=0.16)
            y = self.para(value, bb.LIVE_X, y + 3.8, bb.LIVE_W - 8, size=7.0,
                          colour=bb.C_INK_SOFT, leading=1.45) + 4.6

    # ---------------------------------------------------------------- collections

    def collections_page(self) -> None:
        self.new_page("The collections", outline="Four collections, four arguments",
                      note="Counts are generated from colors.ts.")
        self.font("Serif", bb.T_TITLE, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.3, 21)
        self.cell(bb.LIVE_W, 7, copy.COLLECTION_TITLE)
        self.para(copy.COLLECTION_INTRO, bb.LIVE_X, 31, bb.LIVE_W - 10, size=7.4,
                  colour=bb.C_INK_SOFT)

        y = 58.0
        for name, blurb in copy.COLLECTIONS:
            entries = [c for c in self.colours if c["collection"] == name]
            if not entries:
                raise SystemExit(f"Collection {name!r} has no colours — did colors.ts change?")
            entries.sort(key=lambda c: (-c["lrv"], c["code"]))

            self.font("Serif", 13.5, bb.C_INK)
            self.set_xy(bb.LIVE_X - 0.3, y)
            self.cell(bb.LIVE_W - 26, 5.2, name)
            self.label(f"{len(entries):02d} colours", x=bb.LIVE_R - 26, y=y + 0.8,
                       colour=bb.C_MOSS, size=5.5, track=0.10)

            # The collection's own range, as one continuous band: the fastest way to
            # see what an argument about colour actually looks like.
            band_y = y + 7.0
            gap = 2.2
            chip_w = (bb.LIVE_W - 3 * gap) / 4
            for slot, colour in enumerate(entries[:4]):
                self.fill(bb.LIVE_X + slot * (chip_w + gap), band_y, chip_w, 11.0,
                          bb.rgb(colour["hex"]))
                self.outline(bb.LIVE_X + slot * (chip_w + gap), band_y, chip_w, 11.0,
                             colour=bb.C_LINE, width=bb.HAIR)
                self.font("Sans", 5.4, bb.C_MOSS)
                self.set_xy(bb.LIVE_X + slot * (chip_w + gap), band_y + 11.6)
                self.cell(chip_w, 2.4, f"{colour['code']}  {colour['name']}")

            y = self.para(blurb, bb.LIVE_X, band_y + 15.0, bb.LIVE_W - 8, size=6.9,
                          colour=bb.C_INK_SOFT, leading=1.45) + 7.0

    def matrix_page(self) -> None:
        self.new_page("Methods by surface", outline="Which surface takes which method")
        self.font("Serif", bb.T_TITLE, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.3, 21)
        self.cell(bb.LIVE_W, 7, copy.ROOM_MATRIX_TITLE)
        self.para(copy.ROOM_MATRIX_INTRO, bb.LIVE_X, 31, bb.LIVE_W - 10, size=7.6,
                  colour=bb.C_INK_SOFT)

        y = 56.0
        for name, surfaces in copy.ROOM_MATRIX:
            self.label(name, x=bb.LIVE_X, y=y, colour=bb.C_GREEN, size=6.0, track=0.16)
            y = self.para(surfaces, bb.LIVE_X, y + 4.2, bb.LIVE_W - 8, size=7.4,
                          colour=bb.C_INK_SOFT, leading=1.5) + 6.4

        # Where the methods land on a typical Port Harcourt detached house, drawn as a
        # simple elevation. Not a rendering: a diagram, and labelled as one.
        self.rule(bb.LIVE_X, 128, bb.LIVE_W, colour=bb.C_LINE)
        self.label("On a typical house", x=bb.LIVE_X, y=133, colour=bb.C_MOSS, size=5.8,
                   track=0.14)
        self.para(
            "Threshold on the boundary wall and plinth; Aperture on the entrance and the "
            "walls either side of the openings; Depth on the gate, railings and shutters; "
            "Substrate on everything that has been rendered in one pass.",
            bb.LIVE_X, 139, bb.LIVE_W - 10, size=7.0, colour=bb.C_INK_SOFT, leading=1.5,
        )

        panel = bb.PAGE_H - 52
        self.fill(bb.LIVE_X, panel, bb.LIVE_W, 36, bb.C_PLASTER)
        self.label("Why this order", x=bb.LIVE_X + 6, y=panel + 5.4, colour=bb.C_GREEN,
                   size=5.8, track=0.16)
        self.para(
            "Because a substrate decision can force a colour decision, and a colour decision "
            "can never force a substrate one. If the wall needs a tinted primer, the topcoat "
            "changes; if the topcoat changes, the primer does not.",
            bb.LIVE_X + 6, panel + 10.6, bb.LIVE_W - 12, size=6.9, colour=bb.C_INK_SOFT,
            leading=1.45,
        )

    def order_page(self) -> None:
        self.new_page("Where to start", outline="The order to decide in")
        self.font("Serif", bb.T_TITLE, bb.C_INK)
        self.set_xy(bb.LIVE_X - 0.3, 21)
        self.cell(bb.LIVE_W, 7, copy.ORDER_TITLE)

        y = 36.0
        for number, title, body in copy.ORDER_STEPS:
            self.font("SerifI", 15, bb.C_GREEN)
            self.set_xy(bb.LIVE_X, y - 0.8)
            self.cell(12, 5, number)
            self.font("SansB", 8.2, bb.C_INK)
            self.set_xy(bb.LIVE_X + 12, y)
            self.cell(bb.LIVE_W - 12, 3.4, title)
            y = self.para(body, bb.LIVE_X + 12, y + 4.6, bb.LIVE_W - 14, size=7.4,
                          colour=bb.C_INK_SOFT, leading=1.5) + 6.4

        self.rule(bb.LIVE_X, y, bb.LIVE_W, colour=bb.C_INK, width=0.3)
        self.font("SerifI", 12, bb.C_INK)
        self.set_xy(bb.LIVE_X, y + 4.4)
        self.multi_cell(bb.LIVE_W - 14, 5.4, copy.ORDER_CLOSE)

        panel = 152.0
        self.fill(bb.LIVE_X, panel, bb.LIVE_W, 42, bb.C_GREEN_DEEP)
        self.label("Trade counter", x=bb.LIVE_X + 6, y=panel + 5.6, colour=(190, 214, 202),
                   size=5.7, track=0.20)
        self.font("Serif", 13, bb.C_PAPER_2)
        self.set_xy(bb.LIVE_X + 6, panel + 10.2)
        self.cell(bb.LIVE_W - 12, 5.0, f"{copy.CITY} · Rivers State")
        self.font("Sans", 7.0, (206, 222, 212))
        for offset, line in enumerate([
            f"Colour mixing and trade sales · {self.phone}",
            "Dealers nationwide · opudapaint.com/dealers",
            "hello@opudapaint.com",
        ]):
            self.set_xy(bb.LIVE_X + 6, panel + 17.0 + offset * 4.8)
            self.cell(bb.LIVE_W - 12, 3.2, line)

    def back_cover(self) -> None:
        self.section = "Back"
        self.chrome = False
        self.add_page()
        self.fill(0, 0, bb.PAGE_W, bb.PAGE_H, bb.C_GREEN_DEEP)

        self.draw_mark(bb.LIVE_X, 34, 19, colour=bb.C_PAPER_2, accent=True)
        self.label(copy.BRAND, x=bb.LIVE_X, y=64, colour=bb.C_PAPER_2, size=9.0, track=0.34)
        self.font("SerifI", 16.5, bb.C_PAPER_2)
        self.set_xy(bb.LIVE_X - 0.4, 74)
        self.cell(bb.LIVE_W, 7, copy.BACK_LINE)
        self.rule(bb.LIVE_X, 86, 24, colour=bb.C_PAPER_2, width=0.45)

        self.para(
            "Volume two of the colour library: four methods for choosing paint by the job it "
            "has to do, shown on rooms we have actually painted.",
            bb.LIVE_X, 94, bb.LIVE_W - 20, size=7.8, colour=(204, 220, 210), leading=1.55,
        )

        # The series, stated on the back where it belongs: a reader who bought one
        # volume should be able to see there is another.
        self.label("The series", x=bb.LIVE_X, y=118, colour=(150, 178, 162), size=5.6,
                   track=0.16)
        row = 124.0
        for title, note in [("Colour Book", "the library, indexed by colour"),
                            ("Room Book", "the library, indexed by the job")]:
            self.font("SansSB", 7.6, bb.C_PAPER_2)
            self.set_xy(bb.LIVE_X, row)
            self.cell(bb.LIVE_W, 3, title)
            self.font("Sans", 6.4, (168, 190, 178))
            self.set_xy(bb.LIVE_X, row + 3.4)
            self.cell(bb.LIVE_W, 2.6, note)
            row += 9.6

        row += 3.0
        for line, note in [
            ("opudapaint.com", "Colour library, calculator, dealers"),
            ("hello@opudapaint.com", "Enquiries and specification support"),
            ("Port Harcourt", "Rivers State, Nigeria"),
        ]:
            self.font("SansSB", 7.6, bb.C_PAPER_2)
            self.set_xy(bb.LIVE_X, row)
            self.cell(bb.LIVE_W, 3, line)
            self.font("Sans", 6.4, (168, 190, 178))
            self.set_xy(bb.LIVE_X, row + 3.4)
            self.cell(bb.LIVE_W, 2.6, note)
            row += 9.6

        self.font("Sans", 5.9, (148, 174, 160))
        self.set_xy(bb.LIVE_X, bb.PAGE_H - 30)
        self.multi_cell(
            bb.LIVE_W - 18, 2.8,
            "Plates are OPUDA'S site photographs with a wall repainted. A repainted photograph "
            "is a simulation: confirm every choice against a physical chip before ordering.",
        )


# --------------------------------------------------------------------------- assembly

def main() -> None:
    plates = plates_module.load_plates()
    for plate in plates.values():
        print(f"  plate {plate.coverage_report()}")

    # Page plan. Four methods × (opener + 2 plate pages + notes) = 16 pages,
    # then the collections, the matrix, the order and the back cover.
    method_start = 5          # cover, inside front (the essay), contents, how to read
    per_method = 3            # opener, colourways, the plate
    collections_page = method_start + len(copy.METHODS) * per_method
    matrix_page = collections_page + 1
    order_page = matrix_page + 1
    total_pages = order_page + 1

    plan = [("00", "A colour is not a scheme", 2)]
    for index, method in enumerate(copy.METHODS):
        plan.append((
            method["number"],
            f"{method['name']} — {method['headline']}",
            method_start + index * per_method,
        ))
    plan += [
        ("05", "Four collections, four arguments", collections_page),
        ("06", "Which surface takes which method", matrix_page),
        ("07", "The order to decide in", order_page),
    ]

    with __import__("tempfile").TemporaryDirectory() as directory:
        fonts = bb.export_fonts(Path(directory))
        pdf = RoomBook(plates)
        pdf.plan = plan
        pdf.add_font("Serif", "", str(fonts["serif"]))
        pdf.add_font("SerifI", "", str(fonts["serif_italic"]))
        pdf.add_font("Sans", "", str(fonts["regular"]))
        pdf.add_font("SansSB", "", str(fonts["semibold"]))
        pdf.add_font("SansB", "", str(fonts["bold"]))
        pdf.add_font("SansBlack", "", str(fonts["black"]))

        pdf.cover()
        pdf.inside_front()
        pdf.contents()
        pdf.how_to_read()

        for index, method in enumerate(copy.METHODS):
            pdf.method_opener(method)
            pdf.scheme_page(method, method["schemes"], 1, 1)
            pdf.plate_notes(method)

        pdf.collections_page()
        pdf.matrix_page()
        pdf.order_page()
        pdf.back_cover()

        if pdf.page_no() != total_pages:
            raise SystemExit(f"Planned {total_pages} pages, produced {pdf.page_no()}.")

        OUT.parent.mkdir(parents=True, exist_ok=True)
        pdf.output(str(OUT))

    print(f"\nwrote {OUT.relative_to(ROOT)} · {total_pages} pages · {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
