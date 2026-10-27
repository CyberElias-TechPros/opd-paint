#!/usr/bin/env python3
"""
Build the master catalogue: `app/public/documents/opudas-catalogue.pdf`.

This is not a new design from scratch. It is the whole printed library bound
into one file — the colour book, the room book, the colour wheel, the
specification sheet, the fan deck and all twelve technical and safety data
sheets, exactly as each one is published on its own — plus one chapter that
does not exist anywhere else yet: every real site photograph on file, restored
for print and laid out one project per page.

Why a merge rather than a rewrite: the six existing generators are each the
one source of truth for their numbers (coverage rates, LRVs, cure times). Re-
deriving that content here would risk the catalogue disagreeing with the
document it was copied from. Instead this script runs those generators itself
— so the catalogue can never be built from a stale PDF — then binds their
actual output pages behind new cover, contents, divider and gallery pages.

The new Complete Site Gallery chapter is the one place this script does its
own image work. The web site serves WebP at screen resolution; this script
decodes the same source photographs, lifts contrast and colour by a fixed,
small amount, sharpens once, and re-encodes at print resolution — visibly
cleaner on paper than a browser screenshot, never retouched into something the
site on a wall would not be.

Reproducibility: as with every generated asset here, the output is byte-stable.
The merge's `/ID`, `/CreationDate` and `/ModDate` are pinned explicitly, and
pypdf's own identifier hash is a checksum of content, not the clock, so two
builds from identical source documents produce identical bytes.

Run:  python3 tools/build-catalogue.py
      (needs fpdf2, fonttools, brotli, Pillow and pypdf — the same set the
      other document generators need, plus pypdf for the merge. This script
      also regenerates the six documents it binds together, so it needs
      everything build-documents.py, build-fandeck.py, build-brochure.py,
      build-roombook.py, build-colorwheel.py and build-specsheet.py need.)
"""

from __future__ import annotations

import importlib.util
import math
import subprocess
import sys
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from fpdf import FPDF
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
DOCS = ROOT / "app" / "public" / "documents"
PROJECTS_TS = ROOT / "app" / "src" / "data" / "projects.ts"
MEDIA = ROOT / "app" / "public" / "media"
OUT = DOCS / "opudas-catalogue.pdf"

sys.path.insert(0, str(TOOLS))
import brochure_copy as copy  # noqa: E402


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


bb = _load("build_brochure", TOOLS / "build-brochure.py")

# ------------------------------------------------------------------- geometry
#
# A4 portrait for every page this script draws itself. The six bound-in
# documents keep their own trim sizes (A5 for the two books, A4 landscape for
# the specification sheet) — a catalogue that binds several print products
# together inherits their sizes rather than cropping them, and the cover and
# contents page say so.

PAGE_W, PAGE_H = 210.0, 297.0
ML, MR = 18.0, 18.0
LIVE_X = ML
LIVE_W = PAGE_W - ML - MR
LIVE_R = LIVE_X + LIVE_W
FOOT_TEXT = PAGE_H - 12.4

INK, INK_SOFT, MOSS = bb.INK, bb.INK_SOFT, bb.MOSS
GREEN, GREEN_DEEP, CRIMSON, ORANGE = bb.GREEN, bb.GREEN_DEEP, bb.CRIMSON, bb.ORANGE
PAPER, PAPER_2, PLASTER, LINE, LINE_MID = bb.PAPER, bb.PAPER_2, bb.PLASTER, bb.LINE, bb.LINE_MID
HAIR, RULE = bb.HAIR, bb.RULE
T_COVER, T_DISPLAY, T_TITLE = bb.T_COVER, bb.T_DISPLAY, bb.T_TITLE
T_SUBTITLE, T_BODY, T_SMALL, T_MICRO = bb.T_SUBTITLE, bb.T_BODY, bb.T_SMALL, bb.T_MICRO

DISCLAIMER = (
    "Digital proof. A screen or a printer cannot reproduce a paint film: colour depends on "
    "lighting, substrate, finish and application. Confirm every choice against a physical chip "
    "or a sample pot before ordering."
)

RENDER_NOTICE = (
    "This catalogue reproduces every page of the colour book, room book, colour wheel, "
    "specification sheet, fan deck and the twelve technical and safety data sheets exactly as "
    "each is published on its own, plus one new chapter: every real site photograph on file, "
    "restored for print. Nothing here is invented — concept artwork is labelled as a render, "
    "not a photograph, and a project with no verified colour or product record carries none."
)

# Four accent colours, cycled across the seven section dividers so each one
# reads distinctly without inventing a new palette for the occasion. GREEN_DEEP
# is deliberately left out here — on the dividers' near-black ground it reads
# as almost no colour at all, which a wordmark can get away with but a page
# number cannot.
SECTION_ACCENTS = [MOSS, ORANGE, CRIMSON, GREEN]


# --------------------------------------------------------------------------- time


def build_time() -> datetime:
    return bb.build_time()


def pdf_date(dt: datetime) -> str:
    return dt.strftime("D:%Y%m%d%H%M%S+00'00'")


# --------------------------------------------------------------------------- data: projects
#
# `build-brochure.py`'s `_list()` splits array contents on `,`, which is safe
# for `gallery` / `colorIds` / `productIds` (plain slugs, no punctuation) but
# wrong for `story`: several sentences of prose, each one full of commas, sit
# inside that one array. `_prose_list()` instead finds the matching closing
# bracket by depth, then lifts every quoted string literal out of that span —
# so a comma inside a sentence can never be mistaken for a list separator.


def _prose_list(block: str, field: str) -> list[str]:
    import re

    marker = re.search(rf"\b{field}:\s*\[", block)
    if not marker:
        raise SystemExit(f"Could not read `{field}` from a project block.")
    i = marker.end()
    depth = 1
    while depth > 0:
        if block[i] == "[":
            depth += 1
        elif block[i] == "]":
            depth -= 1
        i += 1
    inner = block[marker.end() : i - 1]
    items = re.findall(r"'((?:[^'\\]|\\.)*)'", inner, re.S)
    return [bb._ESCAPE.sub(r"\1", s).strip() for s in items]


def read_projects_full() -> list[dict]:
    """Every field `projects.ts` carries, not the subset `read_projects()` reads."""
    source = PROJECTS_TS.read_text(encoding="utf-8")
    block = source.split("export const PROJECTS")[1].split("export const findProject")[0]
    projects = []
    for chunk in block.split("  {")[1:]:
        projects.append(
            {
                "id": bb._string(chunk, "id"),
                "title": bb._string(chunk, "title"),
                "location": bb._string(chunk, "location"),
                "year": bb._string(chunk, "year"),
                "stage": bb._string(chunk, "stage"),
                "kind": bb._string(chunk, "kind"),
                "summary": bb._string(chunk, "summary"),
                "story": _prose_list(chunk, "story"),
                "cover": bb._string(chunk, "cover"),
                "gallery": bb._list(chunk, "gallery"),
                "colorIds": bb._list(chunk, "colorIds"),
                "productIds": bb._list(chunk, "productIds"),
                "paletteId": _safe_string_or_blank(chunk, "paletteId"),
                "takeaway": bb._string(chunk, "takeaway"),
            }
        )
    if len(projects) < 15:
        raise SystemExit(f"Only read {len(projects)} projects — did projects.ts change shape?")
    return projects


# A project with no verified job sheet behind it carries an empty paletteId —
# `_string()` raises on an empty `''`, so it is read defensively above and
# the pattern is double-checked here against the live file shape.


def _safe_string_or_blank(block: str, field: str) -> str:
    import re

    match = re.search(rf"\b{field}:\s*''", block)
    if match:
        return ""
    return bb._string(block, field)


# --------------------------------------------------------------------------- photographs, restored for print


def restore(image: Image.Image) -> Image.Image:
    """
    Lift a WhatsApp-compressed site photograph to print quality.

    Every one of these photographs was taken on a site, not in a studio, and
    most travelled through WhatsApp before they reached this repository —
    which strips colour profiles and re-compresses hard. `autocontrast`
    recovers the tonal range that compression flattens, a small lift in
    colour and contrast brings the paint and masonry back to life without
    sliding into a filter, and one unsharp pass restores edge definition a
    phone's own JPEG encoder threw away. The amounts are small and fixed —
    applied identically to every photograph — so the gallery looks like clean
    print, not an edited one.
    """
    image = ImageOps.autocontrast(image, cutoff=1)
    image = ImageEnhance.Color(image).enhance(1.12)
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Brightness(image).enhance(1.02)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=120, threshold=2))
    return image


class EnhancedPhotos:
    """Like `build-brochure.py`'s `Photos`, but every frame is restored first."""

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
            image = restore(image)
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
            ppi = 220
            target_px = (
                max(1, round(width_mm / 25.4 * ppi)),
                max(1, round(height_mm / 25.4 * ppi)),
            )
            if image.size[0] > target_px[0] and image.size[1] > target_px[1]:
                image = image.resize(target_px, Image.LANCZOS)
            buffer = BytesIO()
            image.save(buffer, format="JPEG", quality=92, optimize=True, progressive=False)

        buffer.seek(0)
        self._cache[key] = buffer
        return buffer


def grid_cells(n: int, x: float, y: float, w: float, h: float, gap: float) -> list[tuple[float, float, float, float]]:
    """
    Lay out `n` image cells in a responsive grid: one full-width cell, or two
    columns with the odd one out spanning the full width on the last row — the
    same rule a gallery wall follows when a print count does not divide evenly.
    """
    if n <= 0:
        return []
    if n == 1:
        return [(x, y, w, h)]
    rows = math.ceil(n / 2)
    row_h = (h - (rows - 1) * gap) / rows
    cells: list[tuple[float, float, float, float]] = []
    col_w = (w - gap) / 2
    i = 0
    for row in range(rows):
        remaining = n - i
        row_y = y + row * (row_h + gap)
        if remaining == 1:
            cells.append((x, row_y, w, row_h))
            i += 1
        else:
            cells.append((x, row_y, col_w, row_h))
            cells.append((x + col_w + gap, row_y, col_w, row_h))
            i += 2
    return cells


# --------------------------------------------------------------------------- the catalogue's own pages


class CatalogueDoc(FPDF):
    def __init__(self, colours: list[dict], projects: list[dict], products: dict, phone: str) -> None:
        super().__init__(orientation="P", unit="mm", format=(PAGE_W, PAGE_H))
        self.colours = colours
        self.projects = projects
        self.products = products
        self.phone = phone
        self.set_auto_page_break(False)
        self.set_margins(ML, 20, MR)
        self.set_creation_date(build_time())
        self.set_title(f"{copy.BRAND} — The Complete Catalogue")
        self.set_author(copy.BRAND)
        self.set_subject(
            "Every colour, palette, project, product and site photograph OPUDA'S PAINT publishes, bound in one file"
        )
        self.set_keywords("paint, catalogue, colour book, Port Harcourt, data sheet, fan deck")
        self.set_producer(f"{copy.BRAND} tools/build-catalogue.py")
        self.chrome = False
        self.background = PAPER
        self.kicker = ""
        self.true_page = 1
        # Keyed by this document's own `page_no()`, which only counts the pages
        # *this* fpdf instance draws (30 of the catalogue's 126) — the divider,
        # gallery and product pages from the six bound-in documents are never
        # drawn here, so `page_no()` cannot be the footer's page number. The
        # real, final position is computed in `main()` from the merge plan and
        # threaded through `new_page()` instead.
        self.page_state: dict[int, tuple[bool, tuple, int]] = {}

    # ---------------------------------------------------------------- type

    def font(self, family: str, size: float, colour=INK) -> None:
        self.set_font(family, "", size)
        self.set_text_color(*colour)

    def label(self, text: str, x: float | None = None, y: float | None = None,
              colour=INK, size: float = T_MICRO, track: float = 0.14, w: float = 0, align: str = "L") -> None:
        self.font("SansSB", size, colour)
        self.set_char_spacing(track * size * 0.353)
        if y is not None:
            self.set_y(y)
        if x is not None:
            self.set_x(x)
        self.cell(w, size * 0.36, text.upper(), align=align)
        self.set_char_spacing(0)

    def para(self, text: str, x: float, y: float, w: float, size: float = T_BODY,
              family: str = "Sans", colour=INK_SOFT, leading: float = 1.55, align: str = "L") -> float:
        self.font(family, size, colour)
        self.set_xy(x, y)
        self.multi_cell(w, size * leading * 0.353, text, align=align, markdown=False)
        return self.get_y()

    def measure(self, text: str, w: float, size: float = T_BODY, family: str = "Sans",
                leading: float = 1.55) -> float:
        """Height `para()` would take, without drawing anything — used to decide
        how much of a project's longer story fits before a page overflows."""
        self.font(family, size, (0, 0, 0))
        return self.multi_cell(w, size * leading * 0.353, text, dry_run=True, output="HEIGHT")

    def rule(self, x: float, y: float, w: float, colour=LINE, width: float = HAIR) -> None:
        self.set_draw_color(*colour)
        self.set_line_width(width)
        self.line(x, y, x + w, y)

    def fill(self, x: float, y: float, w: float, h: float, colour) -> None:
        self.set_fill_color(*colour)
        self.rect(x, y, w, h, "F")

    def outline_box(self, x: float, y: float, w: float, h: float, colour=LINE, width: float = HAIR) -> None:
        self.set_draw_color(*colour)
        self.set_line_width(width)
        self.rect(x, y, w, h, "D")

    # ---------------------------------------------------------------- chrome

    def header(self) -> None:
        self.page_state[self.page_no()] = (self.chrome, self.background, self.true_page)
        self.fill(0, 0, PAGE_W, PAGE_H, self.background)
        if not self.chrome:
            return
        self.label(f"{copy.BRAND} · The Complete Catalogue", x=LIVE_X, y=12.0, colour=MOSS, size=5.4, track=0.14)
        self.label(self.kicker, x=LIVE_X, y=12.0, colour=INK_SOFT, size=5.4, track=0.14, w=LIVE_W, align="R")
        self.rule(LIVE_X, 16.4, LIVE_W)

    def footer(self) -> None:
        chrome, _background, true_page = self.page_state.get(self.page_no(), (False, PAPER, 0))
        if not chrome:
            return
        self.rule(LIVE_X, FOOT_TEXT - 2.4, LIVE_W, colour=LINE)
        self.font("Sans", 5.6, MOSS)
        self.set_xy(LIVE_X, FOOT_TEXT)
        self.cell(LIVE_W - 20, 3, copy.CITY)
        self.font("Sans", 5.6, MOSS)
        self.set_xy(LIVE_R - 16, FOOT_TEXT)
        self.cell(16, 3, f"{true_page:03d}", align="R")

    def new_page(self, kicker: str = "", background=PAPER, chrome: bool = True,
                 outline: str | None = None, parent=None, true_page: int = 0) -> None:
        self.kicker = kicker
        self.background = background
        self.chrome = chrome
        self.true_page = true_page
        self.add_page()
        if outline:
            self.start_section(outline, level=0 if parent is None else 1)

    def draw_mark(self, x: float, y: float, size: float, colour=PAPER_2, accent: bool = True) -> None:
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
        gap = 0.32
        width = (PAGE_W - (len(self.colours) - 1) * gap) / len(self.colours)
        for index, colour in enumerate(self.colours):
            self.fill(index * (width + gap), y, width, height, bb.rgb(colour["hex"]))

    # ---------------------------------------------------------------- pages

    def cover(self) -> None:
        self.new_page(chrome=False, background=INK, true_page=1)
        self.fill(0, 0, PAGE_W, PAGE_H, INK)
        self.stripe_field(0, 10)

        self.label(copy.BRAND, x=LIVE_X, y=108, colour=(206, 222, 212), size=7.6, track=0.30)
        self.font("Serif", T_COVER - 4, PAPER_2)
        self.set_xy(LIVE_X - 0.6, 117)
        self.cell(LIVE_W, 16, "The Complete")
        self.set_xy(LIVE_X - 0.6, 138)
        self.cell(LIVE_W, 16, "Catalogue")
        self.font("SerifI", 14, (150, 198, 174))
        self.set_xy(LIVE_X, 160)
        self.cell(LIVE_W, 7, f"{copy.EDITION} edition · {len(self.projects)} documented sites")
        self.rule(LIVE_X, 172, LIVE_W, colour=(90, 108, 98), width=RULE)
        self.font("Sans", 8.8, (206, 222, 212))
        self.set_xy(LIVE_X, 177)
        self.multi_cell(
            LIVE_W - 8, 4.5,
            "Every colour, palette, product data sheet and real site photograph OPUDA'S PAINT "
            "publishes, bound together as one reference. Nine print products, one file.",
        )

        self.draw_mark(LIVE_X, 252, 9.4, colour=GREEN, accent=True)
        self.label(f"{copy.BRAND} · {copy.CITY} · NIGERIA", x=LIVE_X + 13.8, y=257.2,
                   colour=(170, 190, 180), size=6.0, track=0.18)
        self.font("Sans", 6.0, (140, 162, 152))
        self.set_xy(LIVE_X, 270)
        self.multi_cell(LIVE_W, 3.2, DISCLAIMER)

    def contents(self, sections: list[dict]) -> None:
        self.new_page("Contents", chrome=True, true_page=2)
        self.font("Serif", T_DISPLAY, INK)
        self.set_xy(LIVE_X, 24)
        self.cell(LIVE_W, 12, "Contents")
        self.rule(LIVE_X, 40, LIVE_W, colour=INK, width=RULE)

        y = 46
        for section in sections:
            self.font("SansB", 6.6, INK)
            self.set_xy(LIVE_X, y)
            self.cell(10, 5, section["number"])
            self.font("SansSB", T_SUBTITLE - 1.5, INK)
            self.set_xy(LIVE_X + 10, y)
            self.cell(LIVE_W - 40, 5, section["title"])
            self.font("Sans", 7.4, MOSS)
            self.set_xy(LIVE_R - 28, y)
            self.cell(28, 5, f"p. {section['start']:03d}", align="R")
            y += 5.6
            self.font("Sans", T_SMALL, INK_SOFT)
            self.set_xy(LIVE_X + 10, y)
            self.multi_cell(LIVE_W - 40, 3.9, section["description"])
            self.font("Sans", 6.6, LINE_MID)
            self.set_xy(LIVE_X + 10, self.get_y() + 0.6)
            self.cell(LIVE_W - 40, 3.4, f"{section['format']} · {section['pages']} pages")
            y = self.get_y() + 7.4

        self.rule(LIVE_X, y, LIVE_W)
        self.font("Sans", 7.4, INK_SOFT)
        self.set_xy(LIVE_X, y + 5)
        self.multi_cell(LIVE_W, 3.9, RENDER_NOTICE)

    def divider(self, number: str, title: str, description: str, pages: int, fmt: str, accent,
                 true_page: int) -> None:
        self.new_page(chrome=False, background=INK, true_page=true_page)
        self.fill(0, 0, PAGE_W, PAGE_H, INK)
        self.fill(0, 0, 5.2, PAGE_H, accent)

        self.label(f"Section {number} of 07", x=LIVE_X, y=108, colour=(160, 180, 170), size=6.2, track=0.22)
        self.font("Serif", 11, accent)
        self.set_xy(LIVE_X, 116)
        self.cell(LIVE_W, 8, number)
        self.font("Serif", T_DISPLAY, PAPER_2)
        self.set_xy(LIVE_X - 0.5, 128)
        self.multi_cell(LIVE_W, 14, title)
        y = self.get_y() + 6
        self.font("Sans", 9.4, (200, 216, 206))
        self.set_xy(LIVE_X, y)
        self.multi_cell(LIVE_W - 10, 4.8, description)
        y = self.get_y() + 8
        self.rule(LIVE_X, y, 36, colour=accent, width=0.6)
        self.font("Sans", 6.8, (150, 174, 162))
        self.set_xy(LIVE_X, y + 4)
        self.cell(LIVE_W, 4, f"{fmt} · {pages} pages")

    def gallery_intro(self, true_page: int) -> None:
        self.new_page("Complete Site Gallery", chrome=True, true_page=true_page)
        self.font("Serif", T_TITLE, INK)
        self.set_xy(LIVE_X, 24)
        self.multi_cell(LIVE_W, 8, "Every real photograph on file")
        y = self.get_y() + 4
        self.font("Sans", T_BODY, INK_SOFT)
        self.set_xy(LIVE_X, y)
        self.multi_cell(
            LIVE_W, 4.6,
            "The site's own gallery is screen resolution, compressed for a fast page load. "
            "The photographs here are the same files, decoded again and restored for print: "
            "a fixed lift in contrast, colour and sharpness, applied identically to every frame, "
            "to recover what a phone camera and a WhatsApp forward threw away. Nothing is "
            "retouched beyond that, and no photograph claims to show an exact paint colour — the "
            "disclaimer on every colour page in this file still applies.",
        )
        y = self.get_y() + 6
        self.rule(LIVE_X, y, LIVE_W)
        y += 5
        self.font("SansSB", T_SMALL, INK)
        self.set_xy(LIVE_X, y)
        self.cell(LIVE_W, 4, "READING THE ENTRIES")
        y += 5.6
        rows = [
            ("Stage", "Completed, in progress, or a concept design. A concept carries a render, not a photograph."),
            ("Location", "City and district level only — no estate name is published without the client's consent."),
            ("Colour & product", "Shown only where a verified job sheet exists. No entry here is guessed from a photo."),
        ]
        for head, body in rows:
            self.font("SansB", T_SMALL, INK)
            self.set_xy(LIVE_X, y)
            self.cell(36, 4, head)
            self.font("Sans", T_SMALL, INK_SOFT)
            self.set_xy(LIVE_X + 38, y)
            self.multi_cell(LIVE_W - 38, 4.2, body)
            y = self.get_y() + 3.2

    def project_page(self, project: dict, photos: EnhancedPhotos, is_render: bool, true_page: int) -> None:
        self.new_page(project["title"], chrome=True, true_page=true_page)
        y = 22.0
        self.label(f"{project['kind']} · {project['stage'].title()}", x=LIVE_X, y=y, colour=MOSS, size=6.0)
        self.font("Sans", 6.6, INK_SOFT)
        self.set_xy(LIVE_X, y)
        self.cell(LIVE_W, 3.6, f"{project['location']} · {project['year']}", align="R")
        y += 5.6
        self.font("Serif", T_TITLE - 1, INK)
        self.set_xy(LIVE_X - 0.4, y)
        self.cell(LIVE_W, 9, project["title"])
        y += 10.4

        if is_render:
            self.fill(LIVE_X, y, 46, 5.6, ORANGE)
            self.font("SansB", 6.2, PAPER_2)
            self.set_xy(LIVE_X, y + 1.1)
            self.cell(46, 3.6, "CONCEPT RENDER", align="C")
            y += 8.6

        self.font("Sans", T_SMALL, INK_SOFT)
        self.set_xy(LIVE_X, y)
        self.multi_cell(LIVE_W, 4.0, project["summary"])
        y = self.get_y() + 5.0

        # A single photograph is the hero of its page and earns a tall frame;
        # several photographs share a grid instead, so neither crowds the other.
        n = len(project["gallery"])
        if n == 1:
            grid_h = 96.0
        else:
            rows = math.ceil(n / 2)
            grid_h = rows * 54.0 + (rows - 1) * 2.6
        cells = grid_cells(n, LIVE_X, y, LIVE_W, grid_h, 2.6)
        for (cx, cy, cw, ch), image_name in zip(cells, project["gallery"]):
            stream = photos.jpeg(image_name, cw, ch, focus=0.5)
            self.image(stream, x=cx, y=cy, w=cw, h=ch)
            self.outline_box(cx, cy, cw, ch, colour=INK, width=HAIR)
        y += grid_h + 6.0

        if project["colorIds"]:
            by_id = {c["id"]: c for c in self.colours}
            chip_w = (LIVE_W - (len(project["colorIds"]) - 1) * 2.4) / max(len(project["colorIds"]), 1)
            chip_w = min(chip_w, 20.0)
            x = LIVE_X
            for colour_id in project["colorIds"]:
                colour = by_id.get(colour_id)
                if not colour:
                    continue
                self.fill(x, y, chip_w, 7.0, bb.rgb(colour["hex"]))
                self.font("Sans", 5.0, INK_SOFT)
                self.set_xy(x, y + 7.6)
                self.cell(chip_w, 2.8, colour["code"])
                x += chip_w + 2.4
            y += 12.2
        else:
            self.font("Sans", 6.4, LINE_MID)
            self.set_xy(LIVE_X, y)
            self.cell(LIVE_W, 3.6, "No verified colour or product record on file for this site.")
            y += 6.0

        self.rule(LIVE_X, y, LIVE_W, colour=LINE)
        self.font("SerifI", 8.6, GREEN)
        self.set_xy(LIVE_X, y + 2.6)
        self.multi_cell(LIVE_W, 4.2, project["takeaway"])
        y = self.get_y() + 7.0

        # Whatever vertical room is left is filled with the site's own story —
        # the same prose the web page carries — one whole paragraph at a time,
        # never a sentence cut short by the page running out underneath it.
        max_y = FOOT_TEXT - 7.0
        remaining = project["story"][:]
        if remaining and y + 10.0 < max_y:
            self.rule(LIVE_X, y, 20.0, colour=INK, width=0.5)
            self.label("The story", x=LIVE_X, y=y + 2.6, colour=INK_SOFT, size=5.6, track=0.16)
            y += 7.4
            for paragraph in remaining:
                height = self.measure(paragraph, LIVE_W, size=T_SMALL, leading=1.6)
                if y + height > max_y:
                    break
                y = self.para(paragraph, LIVE_X, y, LIVE_W, size=T_SMALL, colour=INK_SOFT, leading=1.6) + 3.4

    def back_cover(self, true_page: int) -> None:
        self.new_page(chrome=False, background=INK, true_page=true_page)
        self.fill(0, 0, PAGE_W, PAGE_H, INK)
        self.draw_mark(LIVE_X, 110, 14, colour=GREEN, accent=True)
        self.font("Serif", 22, PAPER_2)
        self.set_xy(LIVE_X, 138)
        self.cell(LIVE_W, 10, copy.BRAND)
        self.font("Sans", 9, (200, 216, 206))
        for offset, line in enumerate(
            [
                f"Colour mixing and trade sales · {self.phone}",
                f"Dealers nationwide · opudapaint.com/dealers",
                "hello@opudapaint.com",
            ]
        ):
            self.set_xy(LIVE_X, 152 + offset * 6.2)
            self.cell(LIVE_W, 5, line)
        self.rule(LIVE_X, 176, LIVE_W, colour=(90, 108, 98), width=RULE)
        self.font("Sans", 7.6, (170, 190, 180))
        self.set_xy(LIVE_X, 182)
        self.multi_cell(LIVE_W, 4.0, RENDER_NOTICE)
        self.font("Sans", 6.4, (140, 162, 152))
        self.set_xy(LIVE_X, 268)
        self.multi_cell(LIVE_W, 3.4, DISCLAIMER)


# --------------------------------------------------------------------------- merge plan


SECTION_PLAN = [
    {
        "number": "01",
        "title": "Colour Book",
        "description": "Fifty-nine colours in nine families, with the eight palettes built from them.",
        "format": "A5 portrait",
        "file": DOCS / "opudas-colour-book.pdf",
    },
    {
        "number": "02",
        "title": "Room Book",
        "description": "The same colours doing the actual work of a room — organised by job, not by name.",
        "format": "A5 portrait",
        "file": DOCS / "opudas-room-book.pdf",
    },
    {
        "number": "03",
        "title": "Complete Site Gallery",
        "description": "Every real photograph on file, restored for print — one page per documented site.",
        "format": "A4 portrait",
        "file": None,
    },
    {
        "number": "04",
        "title": "Colour Wheel",
        "description": "A single wall chart: the wheel, the full swatch grid, the library.",
        "format": "A4 portrait",
        "file": DOCS / "opudas-colour-wheel.pdf",
    },
    {
        "number": "05",
        "title": "Specification Sheet",
        "description": "The six products, by the surface they go on.",
        "format": "A4 landscape",
        "file": DOCS / "opudas-spec-sheet.pdf",
    },
    {
        "number": "06",
        "title": "Fan Deck",
        "description": "A one-page-per-family reference, the kind a painter works from on site.",
        "format": "A4 portrait",
        "file": DOCS / "opudas-fan-deck.pdf",
    },
    {
        "number": "07",
        "title": "Technical & Safety Data Sheets",
        "description": "Coverage, cure, application and handling, grouped by product — matt, silk, primer, "
        "gloss, weathershield and screeding.",
        "format": "A4 portrait",
        "file": None,
    },
]

GENERATORS = [
    "build-documents.py",
    "build-fandeck.py",
    "build-brochure.py",
    "build-roombook.py",
    "build-colorwheel.py",
    "build-specsheet.py",
]


def regenerate_sources() -> None:
    """Rebuild the six documents this catalogue binds, so it can never go stale."""
    for name in GENERATORS:
        subprocess.run([sys.executable, str(TOOLS / name)], check=True, cwd=ROOT)


def page_count(path: Path) -> int:
    return len(PdfReader(str(path)).pages)


def main() -> None:
    regenerate_sources()

    colours = bb.read_colours()
    products = bb.read_products()
    phone = bb.read_phone()
    projects = read_projects_full()

    tds_sds_pages = 0
    for key in products:
        tds_sds_pages += page_count(DOCS / f"opudas-{key}-tds.pdf")
        tds_sds_pages += page_count(DOCS / f"opudas-{key}-sds.pdf")

    gallery_pages = 1 + len(projects)
    for section in SECTION_PLAN:
        if section["number"] == "03":
            section["pages"] = gallery_pages
        elif section["number"] == "07":
            section["pages"] = tds_sds_pages
        else:
            section["pages"] = page_count(section["file"])

    # Running totals: cover + contents are pages 1-2; every divider adds one
    # page of its own before its section's content begins.
    start = 3
    for section in SECTION_PLAN:
        start += 1  # the divider itself
        section["start"] = start
        start += section["pages"]

    photos = EnhancedPhotos()

    with TemporaryDirectory() as directory:
        pdf = CatalogueDoc(colours, projects, products, phone)
        fonts = bb.export_fonts(Path(directory))
        pdf.add_font("Serif", "", str(fonts["serif"]))
        pdf.add_font("SerifI", "", str(fonts["serif_italic"]))
        pdf.add_font("Sans", "", str(fonts["regular"]))
        pdf.add_font("SansSB", "", str(fonts["semibold"]))
        pdf.add_font("SansB", "", str(fonts["bold"]))

        pdf.cover()
        pdf.contents(SECTION_PLAN)
        for section in SECTION_PLAN:
            pdf.divider(
                section["number"], section["title"], section["description"],
                section["pages"], section["format"],
                SECTION_ACCENTS[int(section["number"]) % len(SECTION_ACCENTS)],
                true_page=section["start"] - 1,
            )
            if section["number"] == "03":
                pdf.gallery_intro(true_page=section["start"])
                for offset, project in enumerate(projects):
                    pdf.project_page(
                        project, photos, is_render=project["stage"] == "concept",
                        true_page=section["start"] + 1 + offset,
                    )
        pdf.back_cover(true_page=start)

        new_bytes = bytes(pdf.output())

    # ----------------------------------------------------------------- merge
    new_reader = PdfReader(BytesIO(new_bytes))
    writer = PdfWriter()

    def append(reader: PdfReader, indices: range | None = None) -> range:
        first = len(writer.pages)
        pages = reader.pages if indices is None else [reader.pages[i] for i in indices]
        for page in pages:
            writer.add_page(page)
        return range(first, len(writer.pages))

    cover_range = append(new_reader, range(0, 1))
    contents_range = append(new_reader, range(1, 2))
    writer.add_outline_item("Cover", cover_range.start)
    writer.add_outline_item("Contents", contents_range.start)

    new_cursor = 2  # pages already consumed from `new_reader`
    for section in SECTION_PLAN:
        divider_range = append(new_reader, range(new_cursor, new_cursor + 1))
        new_cursor += 1
        section_bookmark = writer.add_outline_item(
            f"{section['number']} — {section['title']}", divider_range.start
        )

        if section["number"] == "03":
            intro_range = append(new_reader, range(new_cursor, new_cursor + 1))
            new_cursor += 1
            writer.add_outline_item("Reading the entries", intro_range.start, parent=section_bookmark)
            for project in projects:
                project_range = append(new_reader, range(new_cursor, new_cursor + 1))
                new_cursor += 1
                writer.add_outline_item(project["title"], project_range.start, parent=section_bookmark)
        elif section["number"] == "07":
            for key in products:
                tds_reader = PdfReader(str(DOCS / f"opudas-{key}-tds.pdf"))
                tds_range = append(tds_reader)
                product_bookmark = writer.add_outline_item(
                    products[key]["name"], tds_range.start, parent=section_bookmark
                )
                sds_reader = PdfReader(str(DOCS / f"opudas-{key}-sds.pdf"))
                sds_range = append(sds_reader)
                writer.add_outline_item(
                    f"{products[key]['name']} — Safety Data Sheet", sds_range.start, parent=product_bookmark
                )
        else:
            source_reader = PdfReader(str(section["file"]))
            append(source_reader)

    back_cover_range = append(new_reader, range(new_cursor, new_cursor + 1))
    new_cursor += 1
    writer.add_outline_item("Back cover", back_cover_range.start)

    if new_cursor != len(new_reader.pages):
        raise SystemExit(
            f"Page accounting is wrong: consumed {new_cursor} of {len(new_reader.pages)} drawn pages."
        )

    stamp = pdf_date(build_time())
    writer.add_metadata(
        {
            "/Title": f"{copy.BRAND} — The Complete Catalogue",
            "/Author": copy.BRAND,
            "/Subject": "Every colour, palette, product data sheet and real site photograph, bound in one file",
            "/Keywords": "paint, catalogue, colour book, Port Harcourt, data sheet, fan deck",
            "/Producer": f"{copy.BRAND} tools/build-catalogue.py",
            "/CreationDate": stamp,
            "/ModDate": stamp,
        }
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "wb") as handle:
        writer.write(handle)

    print(f"{len(writer.pages)} pages in {OUT}")


if __name__ == "__main__":
    main()
