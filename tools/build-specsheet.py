#!/usr/bin/env python3
"""
Build the trade specification sheet: `app/public/documents/opudas-spec-sheet.pdf`.

The thing a contractor pins to a board or keeps in a van: every product's
finish, coverage, timing and surfaces on one landscape sheet, instead of six
separate technical data sheets. Everything on it is read from the same
`PRODUCTS` dictionary that builds those six TDS/SDS documents and from
`app/src/data/products.ts`'s `claimsStatus` field — nothing here is typed
twice, and nothing here is a number this file invented.

Where a figure is still awaiting the technical owner's sign-off, the sheet says
so with the same "pending verification" language the website uses, rather than
quietly printing a number as if it had been tested.

Run:  python3 tools/build-specsheet.py
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

import brochure_copy as copy  # noqa: E402

OUT = ROOT / "app" / "public" / "documents" / "opudas-spec-sheet.pdf"
PRODUCTS_TS = ROOT / "app" / "src" / "data" / "products.ts"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


bb = _load("build_brochure", TOOLS / "build-brochure.py")
bd = _load("build_documents", TOOLS / "build-documents.py")

PAGE_W, PAGE_H = 297.0, 210.0  # A4 landscape: a sheet meant to be read flat, not turned.
ML, MR = 14.0, 14.0
LIVE_X = ML
LIVE_W = PAGE_W - ML - MR
LIVE_R = LIVE_X + LIVE_W

INK, INK_SOFT, MOSS = bb.INK, bb.INK_SOFT, bb.MOSS
GREEN, GREEN_DEEP, CRIMSON, ORANGE = bb.GREEN, bb.GREEN_DEEP, bb.CRIMSON, bb.ORANGE
PAPER, PAPER_2, PLASTER, LINE, LINE_MID = bb.PAPER, bb.PAPER_2, bb.PLASTER, bb.LINE, bb.LINE_MID
AMBER = (176, 120, 20)  # for the "pending verification" status chip — a caution, not an error

PRODUCT_ORDER = ["matt", "silk", "primer", "gloss", "weathershield", "screeding"]

GROUPS = [
    ("Interior walls & ceilings", ["matt", "silk"]),
    ("Exterior & boundary walls", ["weathershield"]),
    ("Wood & metal", ["gloss"]),
    ("Preparation & repair", ["primer", "screeding"]),
]

STATUS_LABEL = {
    "label-verified": "Label-verified",
    "pending-verification": "Pending verification",
}


def read_claims_status() -> dict[str, str]:
    """`claimsStatus` lives in products.ts, one level up from the plain-text
    dictionary this sheet otherwise draws from — read it directly rather than
    hand-copying six values that would then be free to drift.

    products.ts nests objects (the `application` steps) inside each product, so
    splitting on a brace finds those too. `id` and `claimsStatus` each appear
    exactly once per product, in that document order, so zipping the two flat
    lists is simpler and safer than trying to delimit object boundaries."""
    source = PRODUCTS_TS.read_text(encoding="utf-8")
    block = source.split("export const PRODUCTS")[1].split("export const findProduct")[0]
    ids = re.findall(r"\bid:\s*'([^']+)'", block)
    values = re.findall(r"claimsStatus:\s*'([^']+)'", block)
    if len(ids) != len(values) or len(ids) < len(PRODUCT_ORDER):
        raise SystemExit(
            f"Read {len(ids)} ids and {len(values)} claimsStatus values — did products.ts change shape?"
        )
    return dict(zip(ids, values))


class SpecSheet(FPDF):
    def __init__(self, products: dict, statuses: dict[str, str], phone: str):
        # fpdf2 swaps a custom (w, h) tuple a second time when orientation="L" is
        # also given, undoing it — so the tuple is passed already landscape and
        # orientation left at its "P" default.
        super().__init__(unit="mm", format=(PAGE_W, PAGE_H))
        self.products = products
        self.statuses = statuses
        self.phone = phone
        self.set_auto_page_break(False)
        self.set_margins(ML, 14, MR)
        self.set_creation_date(bb.build_time())
        self.set_title("OPUDA'S PAINT — Specification Sheet")
        self.set_author("OPUDA'S PAINT")
        self.set_subject("Finish, coverage, timing and surfaces for the six-product range, one sheet")
        self.set_keywords("paint, specification, coverage, technical data, Port Harcourt")
        self.set_producer("OPUDA'S PAINT tools/build-specsheet.py")

    # ---------------------------------------------------------------- helpers
    def font(self, family: str, size: float, colour=INK) -> None:
        self.set_font(family, "", size)
        self.set_text_color(*colour)

    def label(self, text: str, x=None, y=None, colour=INK, size=5.8, track=0.14, align="L", w=0) -> None:
        self.font("SansSB", size, colour)
        self.set_char_spacing(track * size * 0.353)
        if y is not None:
            self.set_y(y)
        if x is not None:
            self.set_x(x)
        self.cell(w, size * 0.36, text.upper(), align=align)
        self.set_char_spacing(0)

    def para(self, text, x, y, w, size=7.4, family="Sans", colour=INK_SOFT, leading=1.5, align="L") -> float:
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

    def status_chip(self, status: str, x: float, y: float) -> float:
        verified = status == "label-verified"
        colour = GREEN if verified else AMBER
        text = STATUS_LABEL[status]
        self.font("SansSB", 5.6, colour)
        w = self.get_string_width(text.upper()) + 5.0
        self.set_draw_color(*colour)
        self.set_line_width(0.22)
        self.rect(x, y, w, 4.0, "D")
        self.set_char_spacing(0.08 * 5.6 * 0.353)
        self.set_xy(x, y + 0.75)
        self.cell(w, 2.6, text.upper(), align="C")
        self.set_char_spacing(0)
        return w

    def chrome(self, title: str, page_no: str) -> None:
        self.label(f"{copy.BRAND} · Specification sheet", x=LIVE_X, y=9.6, colour=MOSS, size=5.6)
        self.font("Sans", 5.8, INK)
        self.set_xy(LIVE_R - 14, 9.6)
        self.cell(14, 2.2, page_no, align="R")
        self.rule(LIVE_X, 13.2, LIVE_W)

    def footer_note(self, note: str) -> None:
        y = PAGE_H - 13.0
        self.rule(LIVE_X, y, LIVE_W, colour=LINE)
        self.font("Sans", 5.4, MOSS)
        self.set_xy(LIVE_X, y + 2.0)
        self.multi_cell(LIVE_W - 32, 2.8, note)
        self.font("Sans", 5.4, MOSS)
        self.set_xy(LIVE_R - 30, y + 2.0)
        self.cell(30, 2.8, copy.CITY, align="R")

    # ---------------------------------------------------------------- page 1
    def overview_page(self) -> None:
        self.add_page()
        self.start_section("By use", level=0)
        self.paint_page()
        self.draw_mark(LIVE_X, 11, 9, colour=GREEN)
        self.chrome("", "01")
        self.font("Serif", 22, INK)
        self.set_xy(LIVE_X - 0.3, 20)
        self.cell(LIVE_W, 9, "Specification sheet")
        self.para(
            "The six products in the range, by the surface they go on. Full application steps "
            "and the complete safety data are in each product's own technical and safety data "
            "sheet, linked at opudapaint.com/products.",
            LIVE_X, 31, LIVE_W, size=7.6,
        )

        col_w = (LIVE_W - 3 * 6.0) / 4
        x = LIVE_X
        y0 = 46.0
        for title, ids in GROUPS:
            y = y0
            self.label(title, x=x, y=y, colour=GREEN, size=6.0, track=0.12, w=col_w)
            y += 6.2
            self.rule(x, y, col_w, colour=LINE_MID)
            y += 4.0
            for pid in ids:
                product = self.products[pid]
                self.font("SerifI", 12.5, INK)
                self.set_xy(x, y)
                self.multi_cell(col_w, 5.2, product["name"].replace("OPUDA'S ", ""))
                y = self.get_y() + 0.6
                self.font("Sans", 6.6, MOSS)
                self.set_xy(x, y)
                self.multi_cell(col_w, 3.0, product["finish"])
                y = self.get_y() + 2.0
                for claim in product["claims"][:3]:
                    self.font("Sans", 6.4, INK_SOFT)
                    self.set_xy(x, y)
                    self.multi_cell(col_w, 3.1, f"— {claim}")
                    y = self.get_y() + 0.6
                y += 1.4
                self.font("SansSB", 6.6, INK)
                self.set_xy(x, y)
                coverage_short = product["coverage"].split(",")[0].replace(" m2 ", " m\u00b2 ")
                self.cell(col_w, 3.4, coverage_short)
                y += 4.8
                w = self.status_chip(self.statuses[pid], x, y)
                y += 7.4
                self.rule(x, y, col_w, colour=LINE)
                y += 4.0
            x += col_w + 6.0

        panel_y = PAGE_H - 48.0
        self.fill(LIVE_X, panel_y, LIVE_W, 20.0, PLASTER)
        self.label("How to read this page", x=LIVE_X + 6, y=panel_y + 4.0, colour=GREEN, size=5.6, track=0.14)
        self.font("Sans", 6.6, INK_SOFT)
        self.set_xy(LIVE_X + 6, panel_y + 8.8)
        self.multi_cell(
            LIVE_W - 12, 3.1,
            "Coverage is per single coat. The status chip under each product marks whether its claims come "
            "from the physical pail (label-verified) or from the standard range a manufacturer at this scale "
            "supplies, awaiting technical sign-off (pending verification). The full comparison, including "
            "touch-dry, recoat and cure times for every product, is overleaf.",
        )

        self.footer_note(
            "\u201cLabel-verified\u201d claims are transcribed from the physical pail; \u201cpending verification\u201d "
            "claims are the standard range a manufacturer at this scale supplies and await technical sign-off."
        )

    # ---------------------------------------------------------------- page 2
    def table_page(self) -> None:
        self.add_page()
        self.start_section("Full comparison", level=0)
        self.paint_page()
        self.chrome("", "02")
        self.font("Serif", 16, INK)
        self.set_xy(LIVE_X - 0.3, 19)
        self.cell(LIVE_W, 7, "Every figure, one table")
        self.para(
            "Coverage is for a single coat on a sound, sealed surface — thin or porous substrates use more. "
            "Touch-dry and recoat times assume 25\u00b0C and 60% relative humidity; Port Harcourt's wet-season "
            "humidity will extend both.",
            LIVE_X, 28, LIVE_W, size=7.0,
        )

        headers = ["Product", "Finish", "Surfaces", "Coverage", "Coats", "Touch dry", "Recoat", "Full cure", "Guarantee", "Status"]
        widths = [34.0, 26.0, 44.0, 30.0, 12.0, 24.0, 20.0, 18.0, 20.0, 30.0]
        y = 42.0
        x = LIVE_X
        for header, width in zip(headers, widths):
            self.label(header, x=x, y=y, colour=MOSS, size=5.2, track=0.08, w=width)
            x += width
        self.rule(LIVE_X, y + 3.6, LIVE_W, colour=INK, width=0.3)
        y += 6.4

        for pid in PRODUCT_ORDER:
            product = self.products[pid]
            row = [
                product["name"].replace("OPUDA'S ", ""),
                product["finish"].split(",")[0].split("(")[0].strip(),
                product["surfaces"],
                product["coverage"].split(",")[0].replace(" m2 ", " m\u00b2 "),
                product["coats"],
                product["touch"].split(" at ")[0],
                product["recoat"],
                product["cure"],
                product["guarantee"],
            ]
            x = LIVE_X
            tallest = 0.0
            for i, (value, width) in enumerate(zip(row, widths)):
                self.font("SansSB" if i == 0 else "Sans", 6.6 if i == 0 else 6.1,
                          INK if i == 0 else INK_SOFT)
                self.set_xy(x, y)
                self.multi_cell(width - 2, 2.9, value)
                tallest = max(tallest, self.get_y() - y)
                x += width
            self.status_chip(self.statuses[pid], x, y + 0.3)
            tallest = max(tallest, 4.6)
            y += tallest + 3.4
            self.rule(LIVE_X, y - 2.0, LIVE_W, colour=LINE)

        y += 3.0
        self.label("Dilution and VOC", x=LIVE_X, y=y, colour=MOSS, size=5.6, track=0.12)
        y += 5.2
        for pid in PRODUCT_ORDER:
            product = self.products[pid]
            self.font("SansSB", 6.2, INK)
            self.set_xy(LIVE_X, y)
            self.cell(34, 3.0, product["name"].replace("OPUDA'S ", ""))
            self.font("Sans", 6.2, INK_SOFT)
            self.set_xy(LIVE_X + 36, y)
            voc = product["voc"].rstrip(".")
            self.multi_cell(LIVE_W - 36, 2.9, f"{product['dilution']} \u2014 {voc}.")
            y = max(y + 3.0, self.get_y()) + 1.6

        panel_y = PAGE_H - 36.0
        self.fill(LIVE_X, panel_y, LIVE_W, 16.0, PLASTER)
        self.font("Serif", 10.5, INK)
        self.set_xy(LIVE_X + 5, panel_y + 3.0)
        self.cell(LIVE_W - 10, 5, "Wall area \u00f7 coverage \u00d7 coats = litres")
        self.font("Sans", 6.4, INK_SOFT)
        self.set_xy(LIVE_X + 5, panel_y + 9.4)
        self.cell(LIVE_W - 10, 3,
                  f"Trade sales and colour mixing \u00b7 {self.phone} \u00b7 {copy.CITY}, Rivers State \u00b7 opudapaint.com/dealers")

        self.footer_note(
            "Guide figures only: confirm coverage and cure times on site before specifying a project, and "
            "treat every price elsewhere in the library as a guide price, not a quotation."
        )


def main() -> None:
    products = bd.PRODUCTS
    statuses = read_claims_status()
    phone = bb.read_phone()

    with TemporaryDirectory() as directory:
        fonts = bb.export_fonts(Path(directory))
        pdf = SpecSheet(products, statuses, phone)
        pdf.add_font("Serif", "", str(fonts["serif"]))
        pdf.add_font("SerifI", "", str(fonts["serif_italic"]))
        pdf.add_font("Sans", "", str(fonts["regular"]))
        pdf.add_font("SansSB", "", str(fonts["semibold"]))
        pdf.add_font("SansB", "", str(fonts["bold"]))

        pdf.overview_page()
        pdf.table_page()

        OUT.parent.mkdir(parents=True, exist_ok=True)
        pdf.output(str(OUT))

    print(f"wrote {OUT.relative_to(ROOT)} \u00b7 {pdf.page_no()} pages \u00b7 {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
