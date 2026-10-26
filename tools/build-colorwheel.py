#!/usr/bin/env python3
"""
Build the colour wheel card: `app/public/documents/opudas-colour-wheel.pdf`.

A single-sheet reference, not a book — the thing you pin to a board at a trade
counter rather than read cover to cover. Three A4 pages: the wheel itself (all
fifty-nine colours as one coloured ring, grouped into the nine families), a
compact swatch grid for when someone needs a code in a hurry, and a contact
panel pointing at the fuller documents.

Geometry, tokens and the family order are imported from the Colour Book rather
than copied, same contract as the Room Book: two documents whose margins or
family order drift apart are two documents that look like two companies. This
one uses its own page size (A4, not A5) because a wheel wants room to breathe,
so it is its own small FPDF subclass rather than a subclass of Book.

Run:  python3 tools/build-colorwheel.py
"""

from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

import brochure_copy as copy  # noqa: E402

OUT = ROOT / "app" / "public" / "documents" / "opudas-colour-wheel.pdf"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


bb = _load("build_brochure", TOOLS / "build-brochure.py")

# ------------------------------------------------------------------- geometry
#
# A4 portrait: a wheel wants more room than the A5 trim the two books use.

PAGE_W, PAGE_H = 210.0, 297.0
ML, MR = 16.0, 16.0
LIVE_X = ML
LIVE_W = PAGE_W - ML - MR
LIVE_R = LIVE_X + LIVE_W

INK, INK_SOFT, MOSS = bb.INK, bb.INK_SOFT, bb.MOSS
GREEN, GREEN_DEEP, CRIMSON, ORANGE = bb.GREEN, bb.GREEN_DEEP, bb.CRIMSON, bb.ORANGE
PAPER, PAPER_2, PLASTER, LINE, LINE_MID = bb.PAPER, bb.PAPER_2, bb.PLASTER, bb.LINE, bb.LINE_MID

DISCLAIMER = (
    "Digital proof. A screen or a printer cannot reproduce a paint film: colour depends on "
    "lighting, substrate, finish and application. Confirm every choice against a physical chip "
    "or a sample pot before ordering."
)


class WheelDoc(FPDF):
    def __init__(self, colours, families, phone):
        super().__init__(orientation="P", unit="mm", format=(PAGE_W, PAGE_H))
        self.colours = colours
        self.families = families
        self.phone = phone
        self.set_auto_page_break(False)
        self.set_margins(ML, 18, MR)
        self.set_creation_date(bb.build_time())
        self.set_title("OPUDA'S PAINT — Colour Wheel")
        self.set_author("OPUDA'S PAINT")
        self.set_subject(f"{len(colours)} colours in nine families, arranged as one wheel")
        self.set_keywords("paint, colour wheel, Port Harcourt, colour card")
        self.set_producer("OPUDA'S PAINT tools/build-colorwheel.py")

    # ---------------------------------------------------------------- helpers
    def font(self, family: str, size: float, colour=INK) -> None:
        self.set_font(family, "", size)
        self.set_text_color(*colour)

    def label(self, text: str, x=None, y=None, colour=INK, size=5.9, track=0.14, align="L", w=0) -> None:
        self.font("SansSB", size, colour)
        self.set_char_spacing(track * size * 0.353)
        if y is not None:
            self.set_y(y)
        if x is not None:
            self.set_x(x)
        self.cell(w, size * 0.36, text.upper(), align=align)
        self.set_char_spacing(0)

    def para(self, text, x, y, w, size=8.2, family="Sans", colour=INK_SOFT, leading=1.55, align="L") -> float:
        self.font(family, size, colour)
        self.set_xy(x, y)
        self.multi_cell(w, size * leading * 0.353, text, align=align, markdown=False)
        return self.get_y()

    def rule(self, x, y, w, colour=LINE, width=0.1) -> None:
        self.set_draw_color(*colour)
        self.set_line_width(width)
        self.line(x, y, x + w, y)

    def fill(self, x, y, w, h, colour) -> None:
        self.set_fill_color(*colour)
        self.rect(x, y, w, h, "F")

    def paint_page(self, colour=PAPER) -> None:
        self.fill(0, 0, PAGE_W, PAGE_H, colour)

    def footer_rule(self, note: str) -> None:
        y = PAGE_H - 16.0
        self.rule(LIVE_X, y, LIVE_W, colour=LINE)
        self.font("Sans", 5.6, MOSS)
        self.set_xy(LIVE_X, y + 2.2)
        self.multi_cell(LIVE_W - 32, 3.0, note)
        self.font("Sans", 5.6, MOSS)
        self.set_xy(LIVE_R - 30, y + 2.2)
        self.cell(30, 3.0, copy.CITY, align="R")

    def draw_mark(self, x: float, y: float, size: float, colour=PAPER_2, accent=True) -> None:
        s = size / 48.0
        self.set_fill_color(*colour)
        roof = [(24, 3.4), (46.5, 20.2), (46.5, 21.6), (1.5, 21.6), (1.5, 20.2)]
        self.polygon([(x + px * s, y + py * s) for px, py in roof], style="F")
        self.rect(x + 10 * s, y + 19.6 * s, 28 * s, 17.7 * s, "F")
        self.set_fill_color(*PAPER_2)
        self.rect(x + 20.5 * s, y + 25.5 * s, 7 * s, 11.8 * s, "F")
        if accent:
            self.set_fill_color(*CRIMSON)
            self.rect(x + 21.6 * s, y + 26.6 * s, 4.8 * s, 10.7 * s, "F")
            self.set_fill_color(*ORANGE)
            self.ellipse(x + 39.1 * s, y + 6.1 * s, 4.6 * s, 4.6 * s, "F")

    # ---------------------------------------------------------------- page 1
    def wheel_page(self) -> None:
        self.add_page()
        self.start_section("The wheel", level=0)
        self.paint_page()
        self.draw_mark(LIVE_X, 10, 11, colour=GREEN)
        self.label(f"{copy.BRAND} · Colour library", x=LIVE_X + 16, y=15.2, colour=MOSS, size=5.9)

        self.font("Serif", 30, INK)
        self.set_xy(LIVE_X - 0.4, 32)
        self.cell(LIVE_W, 11, "The colour wheel")
        self.para(
            f"All {len(self.colours)} colours in the library, arranged as nine wedges of one ring. "
            "Each wedge is a family, each slice within it a colour, lightest to darkest working "
            "outward from the top. It is a map of the library, not a mixing wheel — the slice "
            "widths follow how many colours a family has, not hue theory.",
            LIVE_X, 46, LIVE_W, size=8.4, leading=1.5,
        )

        cx, cy, r_outer, r_inner = PAGE_W / 2, 158.0, 68.0, 20.0
        total = len(self.colours)
        cursor = 0.0
        gap_deg = 0.35
        label_points: list[tuple[float, str, str, int]] = []  # angle, family, hex, count

        # Angle convention here (empirically, from fpdf2's `solid_arc`): 270 degrees
        # is straight up, and increasing the angle sweeps clockwise on the page. So
        # "cursor" below is degrees-of-arc travelled clockwise from the top, and
        # every wedge is `270 + cursor .. 270 + cursor + span`.
        for family in bb.FAMILY_ORDER:
            items = self.families[family]
            span = len(items) / total * 360.0
            family_start = cursor
            colour_span = span / len(items)
            for colour in items:
                a0 = 270 + cursor + gap_deg
                a1 = 270 + cursor + colour_span - gap_deg
                self.set_fill_color(*bb.rgb(colour["hex"]))
                # `solid_arc`'s (x, y) is the upper-left corner of the bounding box and
                # `a`/`b` are the bounding box's *diameters*, despite the docstring
                # calling them semi-axes — it forwards straight to `arc()`, which halves
                # them. So a circle of radius r centred on (cx, cy) needs x = cx - r,
                # y = cy - r, a = b = 2r.
                self.solid_arc(cx - r_outer, cy - r_outer, r_outer * 2, a0, a1, b=r_outer * 2, style="F")
                cursor += colour_span
            mid_angle = 270 + family_start + span / 2
            label_points.append((mid_angle, family, items[len(items) // 2]["hex"], len(items)))

        # Hub: paper-coloured disc so the wedges read as a ring, with the count inside.
        self.set_fill_color(*PAPER)
        self.ellipse(cx - r_inner, cy - r_inner, r_inner * 2, r_inner * 2, "F")
        self.set_draw_color(*LINE_MID)
        self.set_line_width(0.22)
        self.ellipse(cx - r_inner, cy - r_inner, r_inner * 2, r_inner * 2, "D")
        self.font("Serif", 15, INK)
        self.set_xy(cx - r_inner, cy - 6.5)
        self.cell(r_inner * 2, 7, str(total), align="C")
        self.label("colours", x=cx - r_inner, y=cy + 1.5, colour=MOSS, size=5.3, track=0.16, align="C", w=r_inner * 2)
        self.label("nine families", x=cx - r_inner, y=cy + 6.0, colour=MOSS, size=5.3, track=0.16, align="C", w=r_inner * 2)

        # Outer ring hairline, for a crisp edge against the paper.
        self.set_draw_color(*PAPER)
        self.set_line_width(0.6)
        self.ellipse(cx - r_outer, cy - r_outer, r_outer * 2, r_outer * 2, "D")

        # Leader-line labels, placed outside the ring at each family's mid-angle.
        for angle, family, hex_mid, count in label_points:
            rad = math.radians(angle)
            x0, y0 = cx + r_outer * math.cos(rad), cy + r_outer * math.sin(rad)
            x1, y1 = cx + (r_outer + 8) * math.cos(rad), cy + (r_outer + 8) * math.sin(rad)
            self.set_draw_color(*LINE_MID)
            self.set_line_width(0.18)
            self.line(x0, y0, x1, y1)
            right_half = math.cos(rad) >= 0
            tx = x1 + (2.0 if right_half else -2.0)
            align = "L" if right_half else "R"
            box_w = 48.0
            box_x = tx if right_half else tx - box_w
            self.font("SansSB", 7.0, INK)
            self.set_xy(box_x, y1 - 4.4)
            self.cell(box_w, 3.6, family, align=align)
            self.font("Sans", 6.0, MOSS)
            self.set_xy(box_x, y1 - 0.6)
            self.cell(box_w, 3.0, f"{count} colour{'s' if count != 1 else ''}", align=align)

        self.footer_rule(DISCLAIMER)

    # ---------------------------------------------------------------- page 2
    def grid_page(self) -> None:
        self.add_page()
        self.start_section("Every colour", level=0)
        self.paint_page()
        self.label(f"{copy.BRAND} · Colour wheel", x=LIVE_X, y=10.6, colour=MOSS, size=5.5)
        self.font("Sans", 6.0, INK)
        self.set_xy(LIVE_R - 14, 10.6)
        self.cell(14, 2.2, "02", align="R")
        self.rule(LIVE_X, 14.2, LIVE_W)

        self.font("Serif", 17, INK)
        self.set_xy(LIVE_X - 0.3, 20)
        self.cell(LIVE_W, 7, "Every colour, by family")
        self.para(
            "Code and name, grouped the same way as the wheel. For undertone, estimated LRV and "
            "the rooms each colour suits, see the fan deck.",
            LIVE_X, 29, LIVE_W, size=7.4, leading=1.45,
        )

        columns = 8
        gutter = 2.6
        chip_w = (LIVE_W - (columns - 1) * gutter) / columns
        chip_h = 7.2
        row_h = chip_h + 7.2
        y = 40.0

        for family in bb.FAMILY_ORDER:
            items = self.families[family]
            needed_rows = -(-len(items) // columns)
            if y + 6 + needed_rows * row_h > PAGE_H - 20:
                self.add_page()
                self.paint_page()
                self.rule(LIVE_X, 14.2, LIVE_W)
                y = 20.0
            self.label(family, x=LIVE_X, y=y, colour=GREEN, size=6.0, track=0.14)
            y += 5.6
            x = LIVE_X
            col = 0
            for colour in items:
                self.set_fill_color(*bb.rgb(colour["hex"]))
                self.rect(x, y, chip_w, chip_h, "F")
                self.set_draw_color(*LINE)
                self.set_line_width(0.1)
                self.rect(x, y, chip_w, chip_h, "D")
                self.font("SansSB", 5.6, INK)
                self.set_xy(x, y + chip_h + 0.8)
                self.cell(chip_w, 2.6, colour["code"])
                self.font("Sans", 5.3, INK_SOFT)
                self.set_xy(x, y + chip_h + 3.4)
                self.multi_cell(chip_w, 2.4, colour["name"])
                col += 1
                x += chip_w + gutter
                if col == columns:
                    col = 0
                    x = LIVE_X
                    y += row_h
            if col != 0:
                y += row_h
            y += 1.6

        self.footer_rule("Hex values are the single source of truth; a printed chip is still a proof, not a sample.")

    # ---------------------------------------------------------------- page 3
    def contact_page(self) -> None:
        self.add_page()
        self.start_section("The library", level=0)
        self.paint_page(GREEN_DEEP)
        self.draw_mark(LIVE_X, 20, 13)
        self.font("Serif", 24, PAPER_2)
        self.set_xy(LIVE_X - 0.3, 46)
        self.cell(LIVE_W, 9, "One library, three documents.")
        self.para(
            "This card is the quick reference. Two further volumes go deeper, and both are "
            "generated from the same colour data as this card and the website, so none of the "
            "three can quietly disagree with another.",
            LIVE_X, 60, LIVE_W, size=8.4, colour=(206, 222, 212), leading=1.55,
        )

        rows = [
            ("Colour Book", "32 pages, A5. The full library: nine families, eight palettes, "
                             "three jobs and four lights for a single colour, specification and "
                             "an index by room.", "opudas-colour-book.pdf"),
            ("Room Book", "20 pages, A5. Indexed by the job a colour has to do, with four methods "
                          "shown as colourways on OPUDA'S's own site photographs.", "opudas-room-book.pdf"),
            ("Fan Deck", "A4, every colour on its own page with code, hex, estimated LRV and "
                         "recommended rooms — the one to hold next to a wall.", "opudas-fan-deck.pdf"),
        ]
        y = 86.0
        for name, blurb, filename in rows:
            self.font("Serif", 12.5, PAPER_2)
            self.set_xy(LIVE_X, y)
            self.cell(LIVE_W, 5, name)
            y = self.para(blurb, LIVE_X, y + 6.4, LIVE_W, size=7.2, colour=(190, 206, 196), leading=1.48) + 1.6
            self.font("Sans", 6.0, (150, 174, 162))
            self.set_xy(LIVE_X, y)
            self.cell(LIVE_W, 3.0, f"/documents/{filename}")
            y += 9.0

        panel = PAGE_H - 70.0
        self.fill(LIVE_X, panel, LIVE_W, 48, (12, 60, 40))
        self.label("Trade counter", x=LIVE_X + 6, y=panel + 6.0, colour=(190, 214, 202), size=5.8, track=0.2)
        self.font("Serif", 14, PAPER_2)
        self.set_xy(LIVE_X + 6, panel + 11.2)
        self.cell(LIVE_W - 12, 5.6, f"{copy.CITY} · Rivers State")
        self.font("Sans", 7.4, (206, 222, 212))
        for offset, line in enumerate(
            [
                f"Colour mixing and trade sales · {self.phone}",
                "Dealers nationwide · opudapaint.com/dealers",
                "hello@opudapaint.com",
            ]
        ):
            self.set_xy(LIVE_X + 6, panel + 19.6 + offset * 5.4)
            self.cell(LIVE_W - 12, 3.6, line)

        self.font("Sans", 5.8, (150, 174, 162))
        self.set_xy(LIVE_X, PAGE_H - 16)
        self.multi_cell(LIVE_W, 3.0, DISCLAIMER)


def main() -> None:
    colours = bb.read_colours()
    families = bb.by_family(colours)
    phone = bb.read_phone()

    with TemporaryDirectory() as directory:
        fonts = bb.export_fonts(Path(directory))
        pdf = WheelDoc(colours, families, phone)
        pdf.add_font("Serif", "", str(fonts["serif"]))
        pdf.add_font("SerifI", "", str(fonts["serif_italic"]))
        pdf.add_font("Sans", "", str(fonts["regular"]))
        pdf.add_font("SansSB", "", str(fonts["semibold"]))
        pdf.add_font("SansB", "", str(fonts["bold"]))

        pdf.wheel_page()
        pdf.grid_page()
        pdf.contact_page()

        OUT.parent.mkdir(parents=True, exist_ok=True)
        pdf.output(str(OUT))

    print(f"wrote {OUT.relative_to(ROOT)} · {pdf.page_no()} pages · {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
