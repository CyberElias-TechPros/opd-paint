#!/usr/bin/env python3
"""
Build the printed colour book: `app/public/documents/opudas-colour-book.pdf`.

This is the brochure a dealer hands across the counter — A5 portrait, 32 pages,
saddle stitched. It is generated from the same data the website serves, so it can
never list a colour the site has dropped, quote an LRV the site disagrees with, or
describe a product the technical data sheets do not carry.

Sources, in order of authority:

  · `app/src/data/colors.ts` — the colours, their codes, families, undertones and
    hex values. Read by regex, exactly as `build-fandeck.py` reads it.
  · `app/src/data/palettes.ts` and `projects.ts` — the eight palettes and the
    sites the photographs come from.
  · `build-documents.py` — the product dictionary, imported rather than copied,
    so the specification page and the data sheets show one set of numbers.

The prose lives in `brochure_copy.py`, apart from the drawing code.

Reproducibility: as with every generated asset here, the output is byte-stable.
The PDF creation date, the fonts' `head.modified` and every ordering are pinned.
Photographs are decoded from the site's WebP at a fixed quality through Pillow,
which CI pins — so two builds from identical source produce identical bytes, and
`check-assets.py` can treat this file like any other committed artefact.

Run:  python3 tools/build-brochure.py
      (needs fpdf2, fonttools, brotli and Pillow — the same set the other
      document generators need)
"""

from __future__ import annotations

import importlib.util
import os
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from fpdf import FPDF
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"

import sys  # noqa: E402  (sys.path must be set before the sibling import below)

sys.path.insert(0, str(TOOLS))

import brochure_copy as copy  # noqa: E402

COLORS_TS = ROOT / "app" / "src" / "data" / "colors.ts"
PALETTES_TS = ROOT / "app" / "src" / "data" / "palettes.ts"
PROJECTS_TS = ROOT / "app" / "src" / "data" / "projects.ts"
MEDIA = ROOT / "app" / "public" / "media"
OUT = ROOT / "app" / "public" / "documents" / "opudas-colour-book.pdf"
MODULES = ROOT / "app" / "node_modules"

SERIF = MODULES / "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2"
SERIF_ITALIC = MODULES / "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2"
SANS = MODULES / "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2"


# --------------------------------------------------------------------------- time

def build_time() -> datetime:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch:
        return datetime.fromtimestamp(int(epoch), tz=timezone.utc)
    return datetime(2026, 10, 1, tzinfo=timezone.utc)


# --------------------------------------------------------------------------- page geometry
#
# A5 in millimetres: a printer's page, not a web page. Every horizontal position
# below is derived from these numbers, so no page can drift.

PAGE_W, PAGE_H = 148.0, 210.0
ML, MR = 13.0, 13.0
MT, MB = 20.0, 15.0
LIVE_X = ML
LIVE_W = PAGE_W - ML - MR
LIVE_R = LIVE_X + LIVE_W
FOOT_RULE = PAGE_H - 13.6
FOOT_TEXT = PAGE_H - 11.0
COLUMNS = 3
GUTTER = 5.0
ROOM_ORDER = ["Living", "Bedroom", "Kitchen", "Bathroom", "Children", "Office", "Exterior", "Ceiling"]
CHIP_W = (LIVE_W - (COLUMNS - 1) * GUTTER) / COLUMNS


# --------------------------------------------------------------------------- tokens
#
# The same values as `app/src/styles/theme.css`. Print and screen share one
# palette; if they ever disagree, one of the two files was edited alone.

INK = (11, 26, 19)
INK_SOFT = (38, 54, 46)
MOSS = (77, 97, 87)
GREEN = (12, 107, 69)
GREEN_DEEP = (7, 69, 45)
CRIMSON = (193, 18, 31)
ORANGE = (238, 108, 34)
PAPER = (247, 242, 233)
PAPER_2 = (252, 249, 243)
PLASTER = (236, 227, 213)
LINE = (216, 205, 187)
LINE_MID = (169, 160, 142)

HAIR = 0.1    # mm ≈ 0.28pt: the thinnest rule a good press holds
RULE = 0.25

# Type scale in points, named by job rather than by size.
T_COVER = 46
T_DISPLAY = 27
T_TITLE = 17
T_SUBTITLE = 11.5
T_BODY = 8.6
T_SMALL = 7.2
T_MICRO = 5.9


# --------------------------------------------------------------------------- colour maths

def rgb(hex_value: str) -> tuple[int, int, int]:
    return tuple(int(hex_value[i : i + 2], 16) for i in (1, 3, 5))


def _linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(hex_value: str) -> float:
    r, g, b = (int(hex_value[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)


def lrv(hex_value: str) -> int:
    """Estimated light reflectance, quoted the way a fan deck quotes it (0–100)."""
    return round(luminance(hex_value) * 100)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = (la, lb) if la > lb else (lb, la)
    return (hi + 0.05) / (lo + 0.05)


def on_colour(hex_value: str) -> tuple[int, int, int]:
    """The ink or paper token that is most legible on this colour."""
    return INK if contrast(hex_value, "#0b1a13") >= contrast(hex_value, "#fcf9f3") else PAPER_2


def blend(base_hex: str, over_hex: str, amount: float) -> str:
    """Mix two colours, `amount` of the second over the first."""
    a, b = rgb(base_hex), rgb(over_hex)
    return "#" + "".join(
        f"{round(a[i] + (b[i] - a[i]) * amount):02X}" for i in range(3)
    )


def shift_light(hex_value: str, factor: float) -> str:
    """
    Move a colour towards black (factor < 1) or white (factor > 1).

    Used only by the "one colour, four lights" page, which is a teaching device:
    it shows how a surface's apparent value changes with the light, not what a
    camera would record. The page says so in as many words.
    """
    r, g, b = rgb(hex_value)
    if factor <= 1:
        out = (r * factor, g * factor, b * factor)
    else:
        mix = min(factor - 1.0, 1.0)
        out = (r + (255 - r) * mix, g + (255 - g) * mix, b + (255 - b) * mix)
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in out)


# --------------------------------------------------------------------------- data

def read_colours() -> list[dict]:
    source = COLORS_TS.read_text(encoding="utf-8")
    # The exported COLORS is a one-line re-export of COLORS_BASE once the
    # admin-override layer is applied (see app/src/lib/contentOverrides.ts) —
    # the array literal itself is what this needs.
    block = source.split("const COLORS_BASE")[1]
    block = block[: block.find("\nexport ")] if "\nexport " in block else block
    pattern = re.compile(
        r"id:\s*'(?P<id>[^']+)',\s*"
        r"code:\s*'(?P<code>[^']+)',\s*"
        r"name:\s*'(?P<name>[^']+)',\s*"
        r"hex:\s*'(?P<hex>#[0-9A-Fa-f]{6})',\s*"
        r"family:\s*'(?P<family>[^']+)',\s*"
        r"undertone:\s*'(?P<undertone>[^']+)',\s*"
        r"rooms:\s*\[(?P<rooms>[^\]]*)\],\s*"
        r"collection:\s*'(?P<collection>[^']+)'",
        re.S,
    )
    colours = [m.groupdict() for m in pattern.finditer(block)]
    if len(colours) < 40:
        raise SystemExit(f"Only parsed {len(colours)} colours — did colors.ts change shape?")
    for colour in colours:
        colour["lrv"] = lrv(colour["hex"])
        colour["rooms"] = [r.strip().strip("'") for r in colour["rooms"].split(",") if r.strip()]
    return colours


FAMILY_ORDER = [
    "White & Off-White",
    "Warm Neutral",
    "Grey",
    "Green",
    "Blue",
    "Purple & Mauve",
    "Terracotta & Red",
    "Yellow & Ochre",
    "Deep & Architectural",
]


def by_family(colours: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {family: [] for family in FAMILY_ORDER}
    for colour in colours:
        grouped.setdefault(colour["family"], []).append(colour)
    for family, items in grouped.items():
        # Lightest first: a family page should read like a fan deck splaying out.
        items.sort(key=lambda c: (-c["lrv"], c["code"]))
    missing = [f for f, items in grouped.items() if not items]
    if missing:
        raise SystemExit(f"These families have no colours: {missing}")
    return grouped


_ESCAPE = re.compile(r"\\(.)", re.S)


def _string(block: str, field: str) -> str:
    match = re.search(rf"\b{field}:\s*'((?:[^'\\]|\\.)*)'", block, re.S)
    if not match:
        raise SystemExit(f"Could not read `{field}` from a data block.")
    return _ESCAPE.sub(r"\1", match.group(1)).strip()


def _list(block: str, field: str) -> list[str]:
    match = re.search(rf"\b{field}:\s*\[([^\]]*)\]", block, re.S)
    if not match:
        raise SystemExit(f"Could not read `{field}` from a data block.")
    return [item.strip().strip("'") for item in match.group(1).split(",") if item.strip()]


def read_palettes() -> list[dict]:
    source = PALETTES_TS.read_text(encoding="utf-8")
    block = source.split("export const PALETTES")[1].split("export const findPalette")[0]
    palettes = [
        {
            "id": _string(chunk, "id"),
            "name": _string(chunk, "name"),
            "season": _string(chunk, "season"),
            "colors": _list(chunk, "colors"),
            "roles": _list(chunk, "roles"),
            "story": _string(chunk, "story"),
            "bestFor": _string(chunk, "bestFor"),
        }
        for chunk in block.split("  {")[1:]
    ]
    if len(palettes) < 6:
        raise SystemExit(f"Only read {len(palettes)} palettes — did palettes.ts change shape?")
    return palettes


def read_projects() -> list[dict]:
    source = PROJECTS_TS.read_text(encoding="utf-8")
    block = source.split("export const PROJECTS")[1].split("export const findProject")[0]
    return [
        {
            "id": _string(chunk, "id"),
            "title": _string(chunk, "title"),
            "location": _string(chunk, "location"),
            "year": _string(chunk, "year"),
            "cover": _string(chunk, "cover"),
            "summary": _string(chunk, "summary"),
            "colors": _list(chunk, "colorIds"),
        }
        for chunk in block.split("  {")[1:]
    ]


def read_products() -> dict:
    """The one product dictionary in the repository — imported, never copied."""
    spec = importlib.util.spec_from_file_location("build_documents", TOOLS / "build-documents.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.PRODUCTS


def read_phone() -> str:
    """The brand line, taken from the dealer data the website publishes."""
    source = (ROOT / "app" / "src" / "data" / "dealers.ts").read_text(encoding="utf-8")
    match = re.search(r"BRAND_PHONE_DISPLAY\s*=\s*'([^']+)'", source)
    if not match:
        raise SystemExit("Could not read BRAND_PHONE_DISPLAY from dealers.ts")
    return match.group(1)


# --------------------------------------------------------------------------- photographs


class Photos:
    """
    Real site photography, re-encoded for print.

    The web assets are WebP, which PDF cannot carry. Each image is decoded,
    cropped to the exact aspect ratio the layout asks for — so nothing is ever
    squashed, because a stretched photograph of a finished house is the fastest
    way to look untrustworthy — downsampled to roughly 200 ppi at its placed
    size, and encoded once.
    """

    def __init__(self) -> None:
        self._cache: dict[tuple, BytesIO] = {}

    def jpeg(self, name: str, width_mm: float, height_mm: float, focus: float = 0.5) -> BytesIO:
        key = (name, round(width_mm, 1), round(height_mm, 1), round(focus, 2))
        if key in self._cache:
            stream = self._cache[key]
            stream.seek(0)
            return stream

        source = MEDIA / f"{name}.webp"
        if not source.exists():
            raise SystemExit(f"Missing photograph: {source}")

        with Image.open(source) as image:
            image = image.convert("RGB")
            target_ratio = width_mm / height_mm
            w, h = image.size
            if w / h > target_ratio:
                new_w = round(h * target_ratio)
                left = round((w - new_w) * focus)
                image = image.crop((left, 0, left + new_w, h))
            else:
                new_h = round(w / target_ratio)
                top = round((h - new_h) * focus)
                image = image.crop((0, top, w, top + new_h))
            ppi = 200
            target_px = (
                max(1, round(width_mm / 25.4 * ppi)),
                max(1, round(height_mm / 25.4 * ppi)),
            )
            if image.size[0] > target_px[0] and image.size[1] > target_px[1]:
                image = image.resize(target_px, Image.LANCZOS)
            buffer = BytesIO()
            image.save(buffer, format="JPEG", quality=90, optimize=True, progressive=False)

        buffer.seek(0)
        self._cache[key] = buffer
        return buffer


# --------------------------------------------------------------------------- fonts


def export_fonts(directory: Path) -> dict[str, Path]:
    """Turn the site's two WOFF2 families into the TTF files fpdf2 can embed."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    # fontTools stamps `head.modified` with the current time on every save, which
    # would change the embedded font stream — and therefore the PDF — on every
    # build. `head.modified` counts seconds from 1904-01-01, the fontTools epoch.
    fixed = int((build_time() - datetime(1904, 1, 1, tzinfo=timezone.utc)).total_seconds())
    produced: dict[str, Path] = {}

    for name, source in (("serif", SERIF), ("serif_italic", SERIF_ITALIC)):
        font = TTFont(source)
        font.flavor = None
        font.recalcTimestamp = False
        font["head"].modified = fixed
        path = directory / f"{name}.ttf"
        font.save(path)
        produced[name] = path

    for name, weight in (("regular", 400), ("semibold", 600), ("bold", 700), ("black", 800)):
        font = TTFont(SANS)
        font.flavor = None
        # The fontsource build carries a weight axis only; asking for a width axis
        # that is not there raises, so pin just the weight.
        instance = instantiateVariableFont(font, {"wght": weight})
        instance.recalcTimestamp = False
        instance["head"].modified = fixed
        path = directory / f"archivo-{weight}.ttf"
        instance.save(path)
        produced[name] = path

    return produced


# --------------------------------------------------------------------------- the book


class Book(FPDF):
    def __init__(self, colours, families, palettes, projects, products, phone):
        super().__init__(orientation="P", unit="mm", format=(PAGE_W, PAGE_H))
        self.colours = colours
        self.families = families
        self.palettes = palettes
        self.projects = projects
        self.products = products
        self.phone = phone
        self.by_id = {colour["id"]: colour for colour in colours}
        self.photos = Photos()
        self.section = ""
        self.active_family: str | None = None
        self.background = PAPER
        self.chrome = False
        self.note: str | None = None
        self.page_state: dict[int, tuple[bool, str | None, tuple]] = {}

        self.set_auto_page_break(False)
        self.set_margins(ML, MT, MR)
        self.set_creation_date(build_time())
        self.set_title("OPUDA'S PAINT — Colour Book 2026")
        self.set_author("OPUDA'S PAINT")
        self.set_subject(
            f"{len(colours)} colours in nine families, with the palettes and the reasoning behind them"
        )
        self.set_keywords("paint, colour, Port Harcourt, fan deck, palette")
        self.set_producer("OPUDA'S PAINT tools/build-brochure.py")

    # ---------------------------------------------------------------- type

    def font(self, family: str, size: float, colour=INK) -> None:
        self.set_font(family, "", size)
        self.set_text_color(*colour)

    def label(self, text: str, x: float | None = None, y: float | None = None,
              colour=INK, size: float = T_MICRO, track: float = 0.12) -> None:
        """Small caps, letterspaced. `track` is a fraction of the em, not of a point."""
        self.font("SansSB", size, colour)
        self.set_char_spacing(track * size * 0.353)
        # `set_y` moves the abscissa back to the left margin in fpdf2, so the
        # ordinate has to be set before the abscissa — never the other way round.
        if y is not None:
            self.set_y(y)
        if x is not None:
            self.set_x(x)
        self.cell(0, size * 0.36, text.upper())
        self.set_char_spacing(0)

    def para(self, text: str, x: float, y: float, w: float, size: float = T_BODY,
             family: str = "Sans", colour=INK_SOFT, leading: float = 1.55,
             align: str = "L") -> float:
        self.font(family, size, colour)
        self.set_xy(x, y)
        self.multi_cell(w, size * leading * 0.353, text, align=align, markdown=False)
        return self.get_y()

    def rule(self, x: float, y: float, w: float, colour=LINE, width: float = HAIR) -> None:
        self.set_draw_color(*colour)
        self.set_line_width(width)
        self.line(x, y, x + w, y)

    def fill(self, x: float, y: float, w: float, h: float, colour) -> None:
        self.set_fill_color(*colour)
        self.rect(x, y, w, h, "F")

    def outline(self, x: float, y: float, w: float, h: float, colour=LINE, width: float = HAIR) -> None:
        self.set_draw_color(*colour)
        self.set_line_width(width)
        self.rect(x, y, w, h, "D")

    # ---------------------------------------------------------------- chrome

    def header(self) -> None:
        """
        fpdf2 calls this for every page it starts, so page furniture lives here
        rather than in `new_page` — one owner, and no chance of a page being drawn
        twice or not at all. The flags are set before `add_page`, and a page with
        no chrome (cover, chapter openers) paints its own background.
        """
        # fpdf2 runs `header` when a page opens and `footer` when it closes, so the
        # flags have to be recorded per page — reading `self.chrome` in `footer`
        # would give the *next* page's answer.
        self.page_state[self.page_no()] = (self.chrome, self.note, self.background)
        self.fill(0, 0, PAGE_W, PAGE_H, self.background)
        if not self.chrome:
            return
        self.thumb_index(self.active_family)
        self.label(f"{copy.BRAND} · Colour book", x=LIVE_X, y=10.6, colour=MOSS, size=5.5, track=0.14)
        self.label(self.section, x=LIVE_X + 46, y=10.6, colour=INK_SOFT, size=5.5, track=0.14)
        self.font("Sans", 6.0, INK)
        self.set_xy(LIVE_R - 14, 10.6)
        self.cell(14, 2.2, f"{self.page_no():02d}", align="R")
        self.rule(LIVE_X, 14.4, LIVE_W)

    def footer(self) -> None:
        chrome, note, _background = self.page_state.get(self.page_no(), (False, None, PAPER))
        if not chrome:
            return
        self.rule(LIVE_X, FOOT_RULE, LIVE_W, colour=LINE)
        if note:
            self.font("Sans", 5.7, MOSS)
            self.set_xy(LIVE_X, FOOT_TEXT)
            self.cell(LIVE_W - 34, 3, note)
        self.font("Sans", 5.7, MOSS)
        self.set_xy(LIVE_R - 32, FOOT_TEXT)
        self.cell(32, 3, copy.CITY, align="R")

    def thumb_index(self, active: str | None) -> None:
        """
        The colour rail on the fore-edge, one block per family.

        This is a printed book, so the thing that helps most is a thumb index: from
        the edge of a closed copy you can see where you are. The active family's
        block extends further into the page, which is the only difference between
        it and its neighbours. Each block is drawn in the middle colour of its
        family — the lightest one would be invisible on paper.
        """
        segment = PAGE_H / len(FAMILY_ORDER)
        for index, family in enumerate(FAMILY_ORDER):
            items = self.families[family]
            middle = items[len(items) // 2]["hex"]
            width = 7.2 if family == active else 4.2
            # The fore-edge, not the gutter: a thumb index is only useful on the
            # side you can see when the book is closed.
            x = PAGE_W - width
            self.fill(x, index * segment, width, segment, rgb(middle))
            if family == active:
                self.set_draw_color(*PAPER)
                self.set_line_width(0.8)
                self.line(x - 0.4, index * segment + 0.4, x - 0.4,
                          (index + 1) * segment - 0.4)
        self.set_draw_color(*LINE)
        self.set_line_width(HAIR)
        self.line(PAGE_W - 4.6, 0, PAGE_W - 4.6, PAGE_H)

    def new_page(self, section: str, active: str | None = None,
                 background=PAPER, chrome: bool = True, note: str | None = None,
                 outline: str | None = None, level: int = 0) -> None:
        self.section = section
        self.active_family = active
        self.background = background
        self.chrome = chrome
        self.note = note
        self.add_page()
        if outline:
            # The same document is a printed brochure and a file on a dealer's phone.
            # Bookmarks cost nothing and make the second use bearable.
            self.start_section(outline, level=level)

    # ---------------------------------------------------------------- the mark

    def draw_mark(self, x: float, y: float, size: float, colour=PAPER_2, accent: bool = True) -> None:
        """The house mark from `app/public/brand/mark.svg`, drawn as vectors."""
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

    def stripe_field(self, y: float, height: float) -> None:
        """
        The whole library as one field of colour: a stripe per colour, in book order.

        Fifty-nine painted panels say more about a paint company than any photograph
        of a room, and they are the book's own index read edge-on.
        """
        gap = 0.32
        width = (PAGE_W - (len(self.colours) - 1) * gap) / len(self.colours)
        for index, colour in enumerate(self.colours):
            self.fill(index * (width + gap), y, width, height, rgb(colour["hex"]))

    # ---------------------------------------------------------------- pages

    def cover(self) -> None:
        self.section = "Cover"
        self.chrome = False
        self.add_page()
        self.fill(0, 0, PAGE_W, PAGE_H, PAPER)
        self.stripe_field(0, 103)

        self.label(copy.BRAND, x=LIVE_X, y=119, colour=INK, size=7.4, track=0.30)
        self.font("Serif", T_COVER, INK)
        self.set_xy(LIVE_X - 0.6, 127)
        self.cell(LIVE_W, 16, "Colour Book")
        self.font("SerifI", 15, GREEN)
        self.set_xy(LIVE_X, 148)
        self.cell(LIVE_W, 7, f"{len(self.colours)} colours · nine families · {copy.EDITION}")
        self.rule(LIVE_X, 161, LIVE_W, colour=INK, width=RULE)
        self.para(copy.COVER_LINE, LIVE_X, 166, LIVE_W - 8, size=8.8, colour=INK, leading=1.5)

        self.draw_mark(LIVE_X, 186, 8.4, colour=GREEN, accent=True)
        self.label(f"{copy.BRAND} · {copy.CITY} · NIGERIA", x=LIVE_X + 12.4, y=190.4,
                   colour=INK_SOFT, size=5.9, track=0.18)

    def inside_front(self) -> None:
        """A real job, full bleed, with the brand statement set into it."""
        self.section = "Who we are"
        self.chrome = False
        self.add_page()
        photo_h = 132.0
        self.image(self.photos.jpeg("interior-lilac-lounge", PAGE_W, photo_h, focus=0.42),
                   0, 0, PAGE_W, photo_h)
        self.fill(0, photo_h, PAGE_W, PAGE_H - photo_h, INK)

        self.label(copy.BRAND, x=LIVE_X, y=photo_h + 11, colour=(196, 212, 202),
                   size=6.2, track=0.22)
        self.font("Serif", 21, PAPER_2)
        self.set_xy(LIVE_X - 0.4, photo_h + 17)
        self.multi_cell(LIVE_W - 6, 8.2, "Colour mixed\nin Port Harcourt.")
        self.set_xy(LIVE_X, self.get_y() + 2.4)
        self.para(
            "We mix, we supply and we specify. The colour on a wall should be a decision you "
            "can defend — not a lucky guess under a shop light. This book exists to make that "
            "decision smaller.",
            LIVE_X, self.get_y(), LIVE_W - 12, size=8.0, colour=(206, 218, 210), leading=1.55,
        )
        self.rule(LIVE_X, PAGE_H - 16, LIVE_W, colour=(48, 74, 62))
        # The colophon: what the book is set in, and where its facts come from. A
        # brochure that does not say who made it is a leaflet.
        self.font("Sans", 5.4, (140, 164, 150))
        self.set_xy(LIVE_X, PAGE_H - 22)
        self.multi_cell(
            LIVE_W - 16, 2.6,
            "Set in Instrument Serif and Archivo, both under the SIL Open Font License. "
            "Colours, codes, LRVs and product figures are generated from the data that "
            "serves opudapaint.com, so print and screen cannot disagree.",
        )
        self.label(copy.EDITION, x=LIVE_X, y=PAGE_H - 11, colour=(148, 170, 158), size=5.4)
        self.font("Sans", 5.4, (148, 170, 158))
        self.set_xy(LIVE_R - 30, PAGE_H - 11)
        self.cell(30, 3, "ii", align="R")

    def contents(self, entries: list[tuple[str, str, int]]) -> None:
        self.new_page("Contents", outline="Contents")
        self.font("Serif", 33, INK)
        self.set_xy(LIVE_X - 0.5, 25)
        self.cell(LIVE_W, 11, "Contents")
        self.para(
            "The book runs light to deep. Each family opens with the idea behind it and "
            "follows with the range, so a chapter can be read in the shop or handed across a "
            "counter.",
            LIVE_X, 42, LIVE_W - 10, size=8.2, colour=INK_SOFT,
        )

        y = 54.0
        for label, title, page in entries:
            self.label(label, x=LIVE_X, y=y + 1.3, colour=MOSS, size=5.5, track=0.14)
            self.font("SansSB", 8.2, INK)
            self.set_xy(LIVE_X + 14, y)
            self.cell(LIVE_W - 28, 4, title)
            self.font("Sans", 7.8, MOSS)
            self.set_xy(LIVE_R - 11, y)
            self.cell(11, 4, f"{page:02d}", align="R")
            self.rule(LIVE_X, y + 5.3, LIVE_W, colour=LINE)
            y += 9.1

        self.font("SerifI", 10.0, GREEN)
        self.set_xy(LIVE_X, y + 3.0)
        self.multi_cell(LIVE_W - 16, 4.8, "Nine families, and the rooms each one is for.")

    def essay(self) -> None:
        self.new_page("The argument", outline="Colour has a job to do")
        self.font("Serif", 30, INK)
        self.set_xy(LIVE_X - 0.5, 26)
        self.multi_cell(LIVE_W - 6, 11.2, copy.ESSAY_TITLE)
        rule_y = self.get_y() + 4
        self.rule(LIVE_X, rule_y, 26, colour=GREEN, width=0.6)

        y = rule_y + 10
        for index, paragraph in enumerate(copy.ESSAY):
            y = self.para(paragraph, LIVE_X, y, LIVE_W - 4, size=9.0, leading=1.62)
            y += 4.0
            if index == 0:
                # The pull quote sits inside the argument rather than beside it: at
                # A5 there is no second column to hang it in, and an indented block
                # of the serif reads as a change of voice.
                start = y
                self.font("SerifI", 13.5, GREEN)
                self.set_xy(LIVE_X + 7, start)
                self.multi_cell(LIVE_W - 20, 6.2, copy.ESSAY_PULL)
                y = self.get_y() + 4.4
                self.set_draw_color(*GREEN)
                self.set_line_width(0.6)
                self.line(LIVE_X + 4.0, start + 0.4, LIVE_X + 4.0, y - 5.6)

        self.rule(LIVE_X, PAGE_H - 40, LIVE_W, colour=LINE)
        self.draw_mark(LIVE_X, PAGE_H - 34, 6.6, colour=GREEN, accent=True)
        self.font("Sans", 6.4, MOSS)
        self.set_xy(LIVE_X + 9.6, PAGE_H - 33)
        self.multi_cell(LIVE_W - 10, 3.0,
                        "Every figure in this book is generated from the same data the website "
                        "serves. Nothing here is transcribed by hand.")

    def how_to_read(self) -> None:
        self.new_page("How to read this book", outline="How to read this book")
        self.font("Serif", 21, INK)
        self.set_xy(LIVE_X - 0.4, 24)
        self.cell(LIVE_W, 9, copy.HOW_TITLE)
        self.para(copy.HOW_INTRO, LIVE_X, 36, LIVE_W - 8, size=8.0, colour=INK_SOFT)

        # Two columns of two. At A5 a single column of four explained fields would
        # run under the honesty panel, and the panel is the one thing on this page a
        # reader must not miss. Each column is measured as it is set, so the next row
        # starts below whichever column ran longer — never on top of it.
        column_w = (LIVE_W - 7.0) / 2
        y = 50.0
        for row in range(0, len(copy.HOW_FIELDS), 2):
            ends = []
            for column, (field, explanation) in enumerate(copy.HOW_FIELDS[row : row + 2]):
                x = LIVE_X + column * (column_w + 7.0)
                self.label(field, x=x, y=y, colour=GREEN, size=5.9, track=0.16)
                ends.append(
                    self.para(explanation, x, y + 3.8, column_w, size=7.0,
                              colour=INK_SOFT, leading=1.48)
                )
            y = max(ends) + 6.4

        panel_y = max(y + 4.0, 150.0)
        self.fill(LIVE_X, panel_y, LIVE_W, 44, PLASTER)
        self.label(copy.HONESTY_TITLE, x=LIVE_X + 6, y=panel_y + 5.6, colour=CRIMSON,
                   size=6.0, track=0.14)
        self.para(copy.HONESTY, LIVE_X + 6, panel_y + 11.4, LIVE_W - 12, size=6.9,
                  colour=INK, leading=1.5)

    # ---------------------------------------------------------------- chapters

    def chapter_opener(self, index: int, family: str, colours: list[dict]) -> None:
        chapter = copy.CHAPTERS[family]
        lead = colours[0]["hex"]
        text = on_colour(lead)
        self.new_page(f"{index:02d} · {family}", active=family, background=rgb(lead),
                      chrome=False, outline=f"{index:02d} {family}", level=0)

        self.label(f"Chapter {index:02d}", x=LIVE_X, y=14, colour=text, size=5.9, track=0.20)
        self.label(family, x=LIVE_R - 80, y=14, colour=text, size=5.9, track=0.18)

        # A ghost numeral: the chapter number set enormous and blended into the
        # page's own colour, so it reads as texture until you look at it.
        ghost = blend(lead, "#{:02X}{:02X}{:02X}".format(*text), 0.17)
        self.font("Serif", 118, rgb(ghost))
        self.set_xy(LIVE_R - 56, 84)
        self.cell(58, 48, f"{index:02d}", align="R")

        self.font("Serif", T_DISPLAY, text)
        self.set_xy(LIVE_X - 0.5, 33)
        self.multi_cell(LIVE_W - 6, 10.0, chapter["name"])

        self.font("SerifI", T_SUBTITLE, text)
        self.set_xy(LIVE_X, self.get_y() + 2.4)
        self.multi_cell(LIVE_W - 20, 5.0, chapter["subtitle"])

        rule_y = self.get_y() + 5.4
        self.rule(LIVE_X, rule_y, 22, colour=text, width=0.45)

        self.para(chapter["body"], LIVE_X, rule_y + 8.6, LIVE_W - 14, size=8.8,
                  colour=text, leading=1.62)

        base = PAGE_H - 64
        self.label("Recommended areas", x=LIVE_X, y=base, colour=text, size=5.8, track=0.16)
        self.para(" · ".join(chapter["areas"]), LIVE_X, base + 3.8, LIVE_W - 6, size=8.0,
                  colour=text, leading=1.5)
        y = self.get_y() + 4.6
        self.label("On the wall", x=LIVE_X, y=y, colour=text, size=5.8, track=0.16)
        y = self.para(chapter["craft"], LIVE_X, y + 3.8, LIVE_W - 10, size=7.8,
                      colour=text, leading=1.5)
        self.label(f"Pairs with {chapter['pairs']}", x=LIVE_X, y=y + 4.4, colour=text,
                   size=5.8, track=0.16)
        muted_line = rgb(blend(lead, "#{:02X}{:02X}{:02X}".format(*text), 0.22))
        muted_text = rgb(blend(lead, "#{:02X}{:02X}{:02X}".format(*text), 0.5))
        self.rule(LIVE_X, FOOT_RULE, LIVE_W, colour=muted_line)
        self.font("Sans", 5.6, muted_text)
        self.set_xy(LIVE_X, FOOT_TEXT)
        self.cell(LIVE_W * 0.6, 3, f"{copy.EDITION} edition")
        self.set_xy(LIVE_R - 32, FOOT_TEXT)
        self.cell(32, 3, copy.CITY, align="R")

    def chapter_range(self, index: int, family: str, colours: list[dict], note: str) -> None:
        self.new_page(f"{index:02d} · {family}", active=family)
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W - 46, 7, "The range")

        low = min(c["lrv"] for c in colours)
        high = max(c["lrv"] for c in colours)
        self.label(f"{len(colours):02d} colours · LRV {low}–{high}", x=LIVE_R - 46 - 12, y=24,
                   colour=MOSS, size=5.8, track=0.10)

        rows = (len(colours) + COLUMNS - 1) // COLUMNS
        top, bottom = 35.0, 176.0
        pitch = (bottom - top) / rows
        chip_h = pitch - 13.4

        for position, colour in enumerate(colours):
            row, column = divmod(position, COLUMNS)
            x = LIVE_X + column * (CHIP_W + GUTTER)
            y = top + row * pitch
            self.fill(x, y, CHIP_W, chip_h, rgb(colour["hex"]))
            self.outline(x, y, CHIP_W, chip_h, colour=LINE, width=HAIR)

            self.font("SansB", 7.6, INK)
            self.set_xy(x, y + chip_h + 2.0)
            self.cell(CHIP_W, 2.8, colour["name"])
            self.font("Sans", 6.1, MOSS)
            self.set_xy(x, y + chip_h + 5.4)
            self.cell(CHIP_W, 2.4,
                      f"{colour['code']}  ·  LRV {colour['lrv']}  ·  {colour['undertone']}")
            # The hex is for the specifier who will sample it in a design file, set
            # in the smallest type in the book because it is reference, not reading.
            self.font("Sans", 5.5, LINE_MID)
            self.set_xy(x, y + chip_h + 8.2)
            self.cell(CHIP_W, 2.2, colour["hex"].upper())

        self.rule(LIVE_X, 182.6, LIVE_W, colour=LINE)
        self.para(note, LIVE_X, 185.4, LIVE_W - 8, size=6.3, colour=MOSS, leading=1.45)

    # ---------------------------------------------------------------- palettes

    def palette_page(self, page_palettes: list[dict], number: int, total: int) -> None:
        self.new_page("Palettes", note="Roles run left to right.",
                      outline=f"Palettes {number} of {total}", level=1)
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W - 26, 7, "Palettes")
        self.label(f"{number} of {total}", x=LIVE_R - 30, y=24, colour=MOSS, size=5.8)

        slot = 54.0
        for index, palette in enumerate(page_palettes):
            y = 36.0 + index * slot
            self.font("Serif", 15, INK)
            self.set_xy(LIVE_X - 0.4, y)
            self.cell(LIVE_W - 46, 5.6, palette["name"])
            self.label(palette["season"], x=LIVE_R - 44, y=y + 1.4, colour=MOSS, size=5.5,
                       track=0.12)

            chip_y = y + 8.2
            gap = 1.8
            chip_w = (LIVE_W - 3 * gap) / 4
            for position, (colour_id, role) in enumerate(zip(palette["colors"], palette["roles"])):
                colour = self.by_id[colour_id]
                x = LIVE_X + position * (chip_w + gap)
                self.fill(x, chip_y, chip_w, 18.0, rgb(colour["hex"]))
                self.outline(x, chip_y, chip_w, 18.0, colour=LINE, width=HAIR)
                # Code and role sit under the chip in one consistent row: a label
                # inside a swatch has to move about to stay legible, and a row that
                # shifts is harder to read than one that does not.
                self.font("Sans", 5.5, MOSS)
                self.set_xy(x, chip_y + 19.6)
                self.cell(chip_w, 2.4, colour["code"])
                self.font("SansSB", 5.3, INK)
                self.set_xy(x, chip_y + 22.2)
                self.cell(chip_w, 2.4, role)

            story_y = chip_y + 27.0
            self.para(palette["story"], LIVE_X, story_y, LIVE_W - 2, size=6.9, leading=1.45)
            self.para(f"Best for {palette['bestFor'].lower()}.", LIVE_X, self.get_y() + 1.2,
                      LIVE_W - 2, size=6.5, family="SerifI", colour=MOSS, leading=1.35)
            if index < len(page_palettes) - 1:
                self.rule(LIVE_X, 36.0 + (index + 1) * slot - 6.0, LIVE_W, colour=LINE)

    # ---------------------------------------------------------------- projects

    def projects_page(self, picks: list[dict]) -> None:
        self.new_page("On the wall", outline="On the wall")
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W, 7, copy.PROJECT_TITLE)
        self.para(copy.PROJECT_INTRO, LIVE_X, 30, LIVE_W - 10, size=7.4, colour=INK_SOFT)

        big = picks[0]
        self.image(self.photos.jpeg(big["cover"], LIVE_W, 62.0, focus=0.5), LIVE_X, 44, LIVE_W, 62.0)
        self.caption(big, LIVE_X, 108.4)

        small_w = (LIVE_W - 4) / 2
        for index, project in enumerate(picks[1:3]):
            x = LIVE_X + index * (small_w + 4)
            self.image(self.photos.jpeg(project["cover"], small_w, 44.0, focus=0.5),
                       x, 126, small_w, 44.0)
            self.caption(project, x, 172.2, width=small_w, compact=True)

    def caption(self, project: dict, x: float, y: float, width: float | None = None,
                compact: bool = False) -> None:
        width = width or LIVE_W
        self.font("SansB", 7.4, INK)
        self.set_xy(x, y)
        self.cell(width, 3, project["title"])
        self.font("Sans", 6.3, MOSS)
        self.set_xy(x, y + 3.2)
        self.cell(width, 2.6, f"{project['location']} · {project['year']}")

        swatch = 3.6
        chips = [c for c in project["colors"][:6] if c in self.by_id]
        for index, colour_id in enumerate(chips):
            chip_x = x + index * (swatch + 1.2)
            self.fill(chip_x, y + 6.6, swatch, swatch, rgb(self.by_id[colour_id]["hex"]))
            self.outline(chip_x, y + 6.6, swatch, swatch, colour=LINE, width=HAIR)
        if not compact:
            self.font("Sans", 5.7, MOSS)
            self.set_xy(x + len(chips) * (swatch + 1.2) + 1.6, y + 6.6)
            # "Specified", not "in this photograph": the record says which colours
            # were specified for the job, and a print page should not claim more
            # than the data does.
            self.cell(70, swatch, "specified: " + " · ".join(self.by_id[c]["code"] for c in chips))

    # ---------------------------------------------------------------- light

    def light_page(self, colour: dict) -> None:
        self.new_page("One colour, four lights", outline="One colour, four lights")
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W, 7, copy.LIGHT_TITLE)
        self.para(copy.LIGHT_INTRO, LIVE_X, 30, LIVE_W - 8, size=7.4, colour=INK_SOFT)

        top, panel_h, gap = 74.0, 38.0, 2.0
        panel_w = (LIVE_W - 3 * gap) / 4
        for index, (name, factor, explanation) in enumerate(copy.LIGHT_STOPS):
            x = LIVE_X + index * (panel_w + gap)
            shown = shift_light(colour["hex"], factor)
            self.fill(x, top, panel_w, panel_h, rgb(shown))
            self.outline(x, top, panel_h if False else panel_w, panel_h, colour=LINE, width=HAIR)
            self.font("SansB", 6.2, INK)
            self.set_xy(x, top + panel_h + 2.2)
            self.cell(panel_w, 2.6, name)
            self.font("Sans", 5.6, MOSS)
            self.set_xy(x, top + panel_h + 5.0)
            self.cell(panel_w, 2.4, shown.upper())
            self.para(explanation, x, top + panel_h + 8.4, panel_w - 0.4, size=5.8,
                      colour=INK_SOFT, leading=1.45)

        y = 140.0
        self.rule(LIVE_X, y - 4.4, LIVE_W, colour=LINE)
        self.label(f"Worked example · {colour['name']} {colour['code']}", x=LIVE_X, y=y,
                   colour=GREEN, size=5.9, track=0.16)
        y = self.para(
            "This is a demonstration of value, not a photograph: each panel is the same "
            "colour moved lighter or darker, which is what the eye does when the light "
            "changes. The order is what matters. A colour that only works in the noon panel "
            "will disappoint in the evening one.",
            LIVE_X, y + 5.4, LIVE_W - 6, size=7.2, colour=INK_SOFT, leading=1.5,
        )
        y = self.para(
            "Ask which way the room faces before you choose. East and west rooms change "
            "through the day and need a colour that survives both ends. A north-facing room "
            "is the coolest and needs the warmest step in the family. A south wall takes the "
            "steadiest light and can carry the strongest colour.",
            LIVE_X, y + 4.4, LIVE_W - 6, size=7.2, colour=INK_SOFT, leading=1.5,
        )

    # ---------------------------------------------------------------- specification

    def specification(self) -> None:
        self.new_page("Specification", note="Single coat, sealed surface.",
                      outline="Specification")
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W, 7, copy.SPEC_TITLE)
        self.para(copy.SPEC_INTRO, LIVE_X, 30, LIVE_W - 10, size=7.2, colour=INK_SOFT)

        headers = ["Product", "Finish", "Coverage", "Packs"]
        widths = [44.0, 33.0, 27.0, 20.0]
        y = 50.0
        x = LIVE_X
        for header, width in zip(headers, widths):
            self.label(header, x=x, y=y, colour=MOSS, size=5.5, track=0.10)
            x += width
        self.rule(LIVE_X, y + 4.0, LIVE_W, colour=INK, width=0.3)

        y += 7.0
        for product in self.products.values():
            row = [
                product["name"].replace("OPUDA'S ", ""),
                product["finish"],
                product["coverage"].split(",")[0].replace(" m2 ", " m² "),
                # Hydrated into one unbreakable token: a pack list that wraps between
                # "4 L" and "/10 L" reads as two different products.
                product["packs"].replace(" - ", "/").replace(" ", ""),
            ]
            tallest = 0.0
            x = LIVE_X
            for index, (value, width) in enumerate(zip(row, widths)):
                self.font("SansSB" if index == 0 else "Sans", 6.9 if index == 0 else 6.3,
                          INK if index == 0 else (INK_SOFT if index == 2 else MOSS))
                self.set_xy(x, y)
                self.multi_cell(width - 2, 2.8, value)
                tallest = max(tallest, self.get_y() - y)
                x += width
            y += tallest + 3.2
            self.rule(LIVE_X, y - 1.8, LIVE_W, colour=LINE)

        # Which product on which surface, read from the same `surfaces` field the
        # data sheets print: the question a customer asks second, after "how much".
        y += 4.0
        self.label("Where each product goes", x=LIVE_X, y=y, colour=MOSS, size=5.5, track=0.10)
        y += 5.0
        for surface, names in self.surface_matrix().items():
            self.font("SansSB", 6.5, INK)
            self.set_xy(LIVE_X, y)
            self.cell(52, 3, surface)
            self.font("Sans", 6.5, INK_SOFT)
            self.set_xy(LIVE_X + 52, y)
            self.multi_cell(LIVE_W - 52, 2.9, " · ".join(names))
            y = max(y + 3.0, self.get_y()) + 3.4

        panel = 148.0
        self.fill(LIVE_X, panel, LIVE_W, 34, PLASTER)
        self.label("How much paint", x=LIVE_X + 6, y=panel + 4.6, colour=GREEN, size=5.9,
                   track=0.16)
        self.font("Serif", 11.5, INK)
        self.set_xy(LIVE_X + 6, panel + 9.2)
        self.cell(LIVE_W - 12, 5, "Wall area ÷ coverage × coats = litres")
        self.para(
            "A 4 m × 3 m wall is 12 m². Two coats of a product covering 11 m² per litre is "
            "12 ÷ 11 × 2 = 2.2 litres, so a 4 L pack, with enough left over to cut in. "
            "Subtract doors and windows; add ten per cent for a porous or unpainted wall.",
            LIVE_X + 6, panel + 15.6, LIVE_W - 12, size=6.6, colour=INK_SOFT, leading=1.42,
        )

    def surface_matrix(self) -> dict[str, list[str]]:
        """
        Surface → products, from each product's own `surfaces` line.

        The phrases are free text in the data ("Interior walls, kitchens, bathrooms,
        corridors"), so they are normalised into a short list of surfaces rather
        than parsed into anything clever. Anything unrecognised is dropped: a
        surface label this function invents is a claim, and the data sheets are the
        only place allowed to make it.
        """
        wanted = [
            ("Interior walls", ("interior walls", "walls")),
            ("Ceilings", ("ceiling",)),
            ("Kitchens & bathrooms", ("kitchen", "bathroom")),
            ("Exterior walls", ("exterior", "facade", "boundary", "render", "parapet")),
            ("Timber & metal", ("timber", "metal")),
            ("New plaster & blockwork", ("new plaster", "blockwork")),
        ]
        table: dict[str, list[str]] = {}
        for label, needles in wanted:
            names = []
            for product in self.products.values():
                surfaces = product["surfaces"].lower()
                if any(needle in surfaces for needle in needles):
                    names.append(product["name"].replace("OPUDA'S ", "").replace(" Emulsion", ""))
            if names:
                table[label] = names
        return table

    def order_page(self) -> None:
        self.new_page("Where to start", outline="Where to start")
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W, 7, copy.ORDER_TITLE)

        y = 35.0
        for number, title, body in copy.ORDER_STEPS:
            self.font("SerifI", 15, GREEN)
            self.set_xy(LIVE_X, y - 0.8)
            self.cell(12, 5, number)
            self.font("SansB", 8.2, INK)
            self.set_xy(LIVE_X + 12, y)
            self.cell(LIVE_W - 12, 3.4, title)
            y = self.para(body, LIVE_X + 12, y + 4.4, LIVE_W - 14, size=7.2, colour=INK_SOFT,
                          leading=1.5) + 5.0

        self.rule(LIVE_X, y, LIVE_W, colour=INK, width=0.3)
        self.font("SerifI", 11.5, INK)
        self.set_xy(LIVE_X, y + 4)
        self.multi_cell(LIVE_W - 16, 5.2, copy.ORDER_CLOSE)

        panel = 146.0
        self.fill(LIVE_X, panel, LIVE_W, 46, GREEN_DEEP)
        self.label("Trade counter", x=LIVE_X + 6, y=panel + 5.6, colour=(190, 214, 202),
                   size=5.7, track=0.20)
        self.font("Serif", 13.5, PAPER_2)
        self.set_xy(LIVE_X + 6, panel + 10.2)
        self.cell(LIVE_W - 12, 5.4, f"{copy.CITY} · Rivers State")
        self.font("Sans", 7.2, (206, 222, 212))
        for offset, line in enumerate(
            [
                f"Colour mixing and trade sales · {self.phone}",
                "Dealers nationwide · opudapaint.com/dealers",
                "hello@opudapaint.com",
            ]
        ):
            self.set_xy(LIVE_X + 6, panel + 18.0 + offset * 5.0)
            self.cell(LIVE_W - 12, 3.4, line)

    # ---------------------------------------------------------------- by room

    def rooms_page(self) -> None:
        """
        The same library, indexed by where it goes rather than by what it is.

        A fan deck is organised by colour, which is the right order for choosing and
        the wrong order for a question like "what can I put in a bedroom". The room
        tags already exist on every colour for the site's filters; this page is that
        data read the other way round.
        """
        self.new_page("Colours by room", outline="Colours by room")
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X - 0.3, 21)
        self.cell(LIVE_W, 7, "Colours by room")
        self.para(
            "Every colour carries the rooms it suits, the same tags the website filters by. "
            "Use this page when the room is decided and the colour is not.",
            LIVE_X, 30, LIVE_W - 10, size=7.2, colour=INK_SOFT,
        )

        # Fifty-nine colours across eight rooms is too much for one column at A5, so
        # the index flows into two balanced columns. Heights are measured with
        # fpdf2's dry run rather than estimated, and the whole block is refused if it
        # would not fit — an index that silently loses its last room is worse than a
        # build that stops.
        gap = 6.0
        column_w = (LIVE_W - gap) / 2
        top = 42.0
        bottom = PAGE_H - 38

        blocks = []
        for room in ROOM_ORDER:
            entries = sorted(
                (c for c in self.colours if room in c["rooms"]),
                key=lambda c: (-c["lrv"], c["code"]),
            )
            if entries:
                blocks.append((room, len(entries),
                               "  ".join(f"{c['name']} {c['code']}" for c in entries)))

        self.font("Sans", 5.9, INK_SOFT)
        heights = []
        for _room, _count, listing in blocks:
            listing_h = self.multi_cell(column_w, 5.9 * 1.5 * 0.353, listing,
                                        dry_run=True, output="HEIGHT")
            heights.append(4.0 + listing_h + 4.0)

        total = sum(heights)
        target = total / 2
        column, y, used = 0, top, 0.0
        for (room, count, listing), height in zip(blocks, heights):
            if column == 0 and used + height > target and used > total * 0.35:
                column, y, used = 1, top, 0.0
            x = LIVE_X + column * (column_w + gap)
            self.label(f"{room} · {count}", x=x, y=y, colour=GREEN, size=5.6, track=0.14)
            self.font("Sans", 5.9, INK_SOFT)
            self.set_xy(x, y + 3.8)
            self.multi_cell(column_w, 5.9 * 1.5 * 0.353, listing)
            y = self.get_y() + 4.0
            used += height
            if y > bottom:
                raise SystemExit(
                    f"The colours-by-room index overflows at {room!r}. Shorten the room tags "
                    "in colors.ts or split the index across two pages."
                )

        self.rule(LIVE_X, PAGE_H - 34, LIVE_W, colour=LINE)
        self.para(
            "A room tag is a starting point, not a specification: a colour can suit a "
            "bedroom and still be wrong for a bedroom that faces west.",
            LIVE_X, PAGE_H - 30, LIVE_W - 12, size=6.4, family="SerifI", colour=MOSS,
        )

    def back_cover(self) -> None:
        self.section = "Back"
        self.chrome = False
        self.add_page()
        self.fill(0, 0, PAGE_W, PAGE_H, GREEN_DEEP)
        self.stripe_field(PAGE_H - 16, 16)

        self.draw_mark(LIVE_X, 36, 19, colour=PAPER_2, accent=True)
        self.label(copy.BRAND, x=LIVE_X, y=66, colour=PAPER_2, size=9.0, track=0.34)
        self.font("SerifI", 16.5, PAPER_2)
        self.set_xy(LIVE_X - 0.4, 76)
        self.cell(LIVE_W, 7, copy.BACK_LINE)
        self.rule(LIVE_X, 88, 24, colour=PAPER_2, width=0.45)

        self.para("Colour mixed, specified and supplied in Port Harcourt. Dealers nationwide.",
                  LIVE_X, 96, LIVE_W - 24, size=7.8, colour=(204, 220, 210), leading=1.55)

        lines = [
            ("opudapaint.com", "Colour library, calculator, dealers"),
            ("hello@opudapaint.com", "Enquiries and specification support"),
            ("Port Harcourt", "Rivers State, Nigeria"),
        ]
        y = 122.0
        for line, note in lines:
            self.font("SansSB", 7.6, PAPER_2)
            self.set_xy(LIVE_X, y)
            self.cell(LIVE_W, 3, line)
            self.font("Sans", 6.4, (168, 190, 178))
            self.set_xy(LIVE_X, y + 3.4)
            self.cell(LIVE_W, 2.6, note)
            y += 10.0

        self.font("Sans", 5.9, (148, 174, 160))
        self.set_xy(LIVE_X, PAGE_H - 34)
        self.multi_cell(LIVE_W - 18, 2.8,
                        "Printed proof. Colour shown here is an approximation of a paint film: "
                        "confirm every choice against a physical chip before ordering.")


# --------------------------------------------------------------------------- assembly

def main() -> None:
    colours = read_colours()
    families = by_family(colours)
    palettes = read_palettes()
    projects = read_projects()
    products = read_products()
    phone = read_phone()

    # Page numbers have to be known before the contents page is written, so the
    # plan is computed first and the contents page is built from it — then checked
    # against what was actually produced at the end.
    family_start = 6
    palette_start = family_start + len(FAMILY_ORDER) * 2
    palette_pages = 3
    project_page = palette_start + palette_pages
    light_page = project_page + 1
    spec_page = light_page + 1
    order_page = spec_page + 1
    rooms_page = order_page + 1
    total_pages = rooms_page + 1

    with TemporaryDirectory() as directory:
        fonts = export_fonts(Path(directory))
        pdf = Book(colours, families, palettes, projects, products, phone)
        pdf.add_font("Serif", "", str(fonts["serif"]))
        pdf.add_font("SerifI", "", str(fonts["serif_italic"]))
        pdf.add_font("Sans", "", str(fonts["regular"]))
        pdf.add_font("SansSB", "", str(fonts["semibold"]))
        pdf.add_font("SansB", "", str(fonts["bold"]))
        pdf.add_font("SansBlack", "", str(fonts["black"]))

        entries: list[tuple[str, str, int]] = [("00", "Colour has a job to do", 5)]
        for index, family in enumerate(FAMILY_ORDER, start=1):
            entries.append((f"{index:02d}", f"{family} — {copy.CHAPTERS[family]['name']}",
                            family_start + (index - 1) * 2))
        entries.append(("10", "Palettes that already work", palette_start))
        entries.append(("11", "On the wall", project_page))
        entries.append(("12", "One colour, four lights", light_page))
        entries.append(("13", "Specification", spec_page))
        entries.append(("14", "Where to start", order_page))
        entries.append(("15", "Colours by room", rooms_page))

        pdf.cover()
        pdf.inside_front()
        pdf.contents(entries)
        pdf.how_to_read()
        pdf.essay()

        for index, family in enumerate(FAMILY_ORDER, start=1):
            chapter_colours = families[family]
            note = (f"{copy.CHAPTERS[family]['craft']} Pairs with "
                    f"{copy.CHAPTERS[family]['pairs']}.")
            pdf.chapter_opener(index, family, chapter_colours)
            pdf.chapter_range(index, family, chapter_colours, note)

        per_page = 3
        page_total = -(-len(palettes) // per_page)
        for number in range(0, len(palettes), per_page):
            pdf.palette_page(palettes[number : number + per_page],
                             number // per_page + 1, page_total)

        picks = [next(p for p in projects if p["id"] == wanted)
                 for wanted in ("arched-villa-gra", "lilac-lounge-gra", "creek-facade")]
        pdf.projects_page(picks)
        pdf.light_page(next(c for c in colours if c["id"] == "terracotta"))
        pdf.specification()
        pdf.order_page()
        pdf.rooms_page()
        pdf.back_cover()

        if pdf.page_no() != total_pages:
            raise SystemExit(f"Planned {total_pages} pages, produced {pdf.page_no()}.")

        OUT.parent.mkdir(parents=True, exist_ok=True)
        pdf.output(str(OUT))

    print(f"wrote {OUT.relative_to(ROOT)} · {total_pages} pages · {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
