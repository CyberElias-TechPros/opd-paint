#!/usr/bin/env python3
"""
Generate the printable colour fan deck from `app/src/data/colors.ts`.

A dealer needs something to hold next to a wall. This builds an A4 deck: a cover,
a how-to-use page, then every colour grouped by family with its code, name, hex
and estimated LRV, set in the same two typefaces the site uses.

The hex values are read straight out of the TypeScript module, so the deck cannot
list a colour the site has dropped. It is a *digital proof*: the cover and every
page say so, because a printed chip from a hex value is still not a paint chip.

Run:  python3 tools/build-fandeck.py   (needs fpdf2, fonttools, brotli)
"""
import re
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
COLORS_TS = ROOT / "app" / "src" / "data" / "colors.ts"
OUT = ROOT / "app" / "public" / "documents" / "opudas-fan-deck.pdf"
MODULES = ROOT / "app" / "node_modules"

SERIF = MODULES / "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2"
SANS = MODULES / "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2"

INK = (11, 26, 19)
GREEN = (12, 107, 69)
MOSS = (77, 97, 87)
PAPER = (247, 242, 233)
PAPER_2 = (252, 249, 243)
LINE = (216, 205, 187)

DISCLAIMER = (
    "Digital proof. A screen or a printer cannot reproduce a paint film: colour depends on lighting, "
    "substrate, finish and application. Confirm every choice against a physical chip or a sample pot "
    "before ordering. LRV values are calculated from the digital value, not measured from dried paint."
)


def read_colours() -> list[dict]:
    source = COLORS_TS.read_text(encoding="utf-8")
    block = source.split("export const COLORS")[1]
    block = block[: block.find("\nexport ")] if "\nexport " in block else block

    pattern = re.compile(
        r"id:\s*'(?P<id>[^']+)',\s*"
        r"code:\s*'(?P<code>[^']+)',\s*"
        r"name:\s*'(?P<name>[^']+)',\s*"
        r"hex:\s*'(?P<hex>#[0-9A-Fa-f]{6})',\s*"
        r"family:\s*'(?P<family>[^']+)',\s*"
        r"undertone:\s*'(?P<undertone>[^']+)'",
        re.S,
    )
    colours = [match.groupdict() for match in pattern.finditer(block)]
    if not colours:
        raise SystemExit("No colours parsed — did the shape of colors.ts change?")
    return colours


def lrv(hex_value: str) -> int:
    """Relative luminance, expressed the way a fan deck quotes LRV (0–100)."""
    r, g, b = (int(hex_value[i : i + 2], 16) / 255 for i in (1, 3, 5))
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return round((0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]) * 100)


def rgb(hex_value: str) -> tuple[int, int, int]:
    return tuple(int(hex_value[i : i + 2], 16) for i in (1, 3, 5))


def export_fonts(directory: Path) -> dict[str, Path]:
    """Convert the site's woff2 files into static TTFs fpdf2 can embed."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    produced = {}

    serif = TTFont(SERIF)
    serif.flavor = None
    produced["serif"] = directory / "InstrumentSerif.ttf"
    serif.save(produced["serif"])

    for name, weight in (("sans", 400), ("sans_bold", 700)):
        font = TTFont(SANS)
        font.flavor = None
        instance = instantiateVariableFont(font, {"wght": weight})
        path = directory / f"Archivo-{weight}.ttf"
        instance.save(path)
        produced[name] = path

    return produced


class Deck(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*GREEN)
        self.rect(0, 0, 210, 16, "F")
        self.set_text_color(*PAPER_2)
        self.set_font("Sans", "B", 8)
        self.set_xy(14, 5.5)
        self.cell(120, 5, "OPUDA'S PAINT  ·  COLOUR LIBRARY", align="L")
        self.cell(0, 5, f"{date.today():%B %Y}", align="R")
        self.set_text_color(*INK)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-18)
        self.set_draw_color(*LINE)
        self.line(14, self.get_y(), 196, self.get_y())
        self.set_y(-15)
        self.set_font("Sans", "", 6.5)
        self.set_text_color(*MOSS)
        self.multi_cell(150, 3.6, "Digital proof — confirm against a physical chip or sample pot.", align="L")
        self.set_xy(160, -15)
        self.cell(36, 3.6, f"{self.page_no()}", align="R")
        self.set_text_color(*INK)


def cover(pdf: Deck, colours: list[dict], fonts: dict[str, Path]) -> None:
    pdf.add_page()
    pdf.set_fill_color(*PAPER)
    pdf.rect(0, 0, 210, 297, "F")

    pdf.set_xy(14, 18)
    pdf.set_font("Serif", "", 15)
    pdf.set_text_color(*GREEN)
    pdf.cell(0, 8, "OPUDA'S PAINT", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Sans", "B", 7.5)
    pdf.set_text_color(*MOSS)
    pdf.cell(0, 4, "M A N U F A C T U R E D   I N   L A G O S", new_x="LMARGIN", new_y="NEXT")

    pdf.set_xy(14, 62)
    pdf.set_font("Serif", "", 46)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 17, "The colour\nlibrary.", new_x="LMARGIN", new_y="NEXT")

    pdf.set_xy(14, 118)
    pdf.set_font("Sans", "", 10)
    pdf.set_text_color(*MOSS)
    pdf.multi_cell(
        120,
        5.4,
        f"{len(colours)} colours, each with a permanent code, a family, an undertone and an estimated light "
        "reflectance value. Grouped by family, in the order the site lists them.",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    # A strip of the whole library, in library order, as a single band.
    band_y = 152
    chip_w = 182 / len(colours)
    for index, colour in enumerate(colours):
        pdf.set_fill_color(*rgb(colour["hex"]))
        pdf.rect(14 + index * chip_w, band_y, chip_w + 0.3, 34, "F")

    pdf.set_xy(14, band_y + 42)
    pdf.set_font("Sans", "", 7)
    pdf.set_text_color(*MOSS)
    pdf.multi_cell(150, 4, DISCLAIMER, new_x="LMARGIN", new_y="NEXT")

    pdf.set_xy(14, 258)
    pdf.set_font("Sans", "B", 9)
    pdf.set_text_color(*INK)
    pdf.cell(0, 5, "0902 642 4350", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Sans", "", 8)
    pdf.set_text_color(*MOSS)
    pdf.cell(0, 4, "Revision " + date.today().strftime("%Y-%m"), new_x="LMARGIN", new_y="NEXT")


def how_to_use(pdf: Deck) -> None:
    pdf.add_page()
    pdf.set_xy(14, 30)
    pdf.set_font("Serif", "", 26)
    pdf.set_text_color(*INK)
    pdf.cell(0, 10, "How to read this deck", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    rules = [
        (
            "Every colour has a permanent code.",
            "OP-001 is not a catalogue number that moves between seasons. Quote it to a dealer, write it on a "
            "site instruction, or put it in a specification — it will still mean this colour next year.",
        ),
        (
            "LRV is the light reflectance value.",
            "0 is absolute black, 100 is absolute white. Above 70 a wall bounces light around a room; below 30 "
            "it absorbs it. In a north-facing Lagos room, a mid-tone reads darker than it looks on paper.",
        ),
        (
            "Undertone matters more than the family.",
            "A warm white beside a cool white looks yellow; beside a true white it looks pink. The undertone on "
            "each card tells you what the colour will do next to its neighbours.",
        ),
        (
            "This deck is a digital proof.",
            "The swatches are printed from hex values, not from paint. Printers, paper and light all shift a "
            "colour. Always confirm against a physical chip or a sample pot painted on the actual wall.",
        ),
        (
            "Two coats, always.",
            "Coverage figures in the product sheets assume two coats on a sealed surface. One coat over new "
            "plaster is a patchy result, not a saving.",
        ),
    ]

    for title, body in rules:
        pdf.set_font("Sans", "B", 10)
        pdf.set_text_color(*GREEN)
        pdf.multi_cell(0, 5.5, title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Sans", "", 9)
        pdf.set_text_color(*INK)
        pdf.multi_cell(0, 5, body, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)


def family_pages(pdf: Deck, colours: list[dict]) -> None:
    families: dict[str, list[dict]] = {}
    for colour in colours:
        families.setdefault(colour["family"], []).append(colour)

    for family, members in families.items():
        pdf.add_page()
        pdf.set_xy(14, 24)
        pdf.set_font("Serif", "", 24)
        pdf.set_text_color(*INK)
        pdf.cell(0, 9, family, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Sans", "", 8)
        pdf.set_text_color(*MOSS)
        undertones = sorted({m["undertone"] for m in members})
        pdf.cell(0, 4, f"{len(members)} colour{'s' if len(members) != 1 else ''} · {' / '.join(undertones)} undertone", new_x="LMARGIN", new_y="NEXT")

        top = 42
        card_w, card_h = 86, 56
        gap_x, gap_y = 8, 8
        per_row = 2

        for index, colour in enumerate(members):
            row, column = divmod(index, per_row)
            x = 14 + column * (card_w + gap_x)
            y = top + row * (card_h + gap_y)

            if y + card_h > 268:
                pdf.add_page()
                pdf.set_xy(14, 24)
                pdf.set_font("Serif", "", 20)
                pdf.set_text_color(*INK)
                pdf.cell(0, 8, f"{family} (continued)", new_x="LMARGIN", new_y="NEXT")
                row = 0
                y = top
                x = 14

            pdf.set_fill_color(*rgb(colour["hex"]))
            pdf.rect(x, y, card_w, 34, "F")
            pdf.set_draw_color(*LINE)
            pdf.rect(x, y, card_w, 34)

            pdf.set_xy(x, y + 36)
            pdf.set_font("Sans", "B", 6.6)
            pdf.set_text_color(*MOSS)
            pdf.cell(24, 3.6, colour["code"], align="L")
            pdf.set_font("Sans", "", 6.6)
            pdf.cell(card_w - 24, 3.6, f"{colour['hex']}   ·   LRV ~{lrv(colour['hex'])}", align="R")

            pdf.set_xy(x, y + 40)
            pdf.set_font("Serif", "", 14)
            pdf.set_text_color(*INK)
            pdf.cell(card_w, 6, colour["name"])

            pdf.set_xy(x, y + 47)
            pdf.set_font("Sans", "", 7)
            pdf.set_text_color(*MOSS)
            pdf.cell(card_w, 3.6, f"{colour['undertone']} undertone")


def main() -> None:
    colours = read_colours()
    with TemporaryDirectory() as tmp:
        fonts = export_fonts(Path(tmp))
        pdf = Deck(format="A4")
        pdf.set_auto_page_break(False)
        pdf.set_margins(14, 14, 14)
        pdf.add_font("Serif", "", str(fonts["serif"]))
        pdf.add_font("Sans", "", str(fonts["sans"]))
        pdf.add_font("Sans", "B", str(fonts["sans_bold"]))
        pdf.set_title("OPUDA'S PAINT — colour library")
        pdf.set_author("OPUDA'S PAINT")
        pdf.set_subject("Colour fan deck (digital proof)")

        cover(pdf, colours, fonts)
        how_to_use(pdf)
        family_pages(pdf, colours)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        pdf.output(str(OUT))

    print(f"wrote {OUT.relative_to(ROOT)} — {len(colours)} colours, {pdf.page_no()} pages, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
