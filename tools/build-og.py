#!/usr/bin/env python3
"""
Build the social sharing card (1200 x 630).

Social platforms crop a shared link to roughly 1.9:1, so handing them a 4:3
photograph guarantees the product is cut off. This composes a card from the
company's own material instead: the brand mark, one of the site photographs, six
colours from the palette and the two facts a viewer can act on.

The card is set in the site's real typefaces. The web fonts ship as woff2, which
Pillow cannot open, so `font_tools` decompresses them in memory — the card and
the site therefore cannot drift apart. If fonttools is unavailable the script
falls back to DejaVu and says so.

Run:  python3 tools/build-og.py   (needs: pip install fonttools brotli)
"""
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "app" / "public"
MEDIA = PUBLIC / "media"
MODULES = ROOT / "app" / "node_modules"

SERIF = MODULES / "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2"
SERIF_ITALIC = MODULES / "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2"
SANS = MODULES / "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2"

INK = (11, 26, 19)
GREEN = (12, 107, 69)
MUTED = (77, 97, 87)
PAPER = (247, 242, 233)
BODY = (38, 54, 46)
LETTER_COLOURS = [(193, 18, 31), (12, 107, 69), (31, 111, 178), (108, 63, 164), (238, 108, 34)]

# Six colours that read as a range: white, stone, sand, sage, blue, clay.
CHIPS = ["#F8F5EE", "#EBE4D5", "#C9B394", "#6E7F63", "#2F7FA8", "#B4654A"]

_cache: dict[tuple[str, int, int | None], ImageFont.FreeTypeFont] = {}


def load(spec: Path, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    """Open a woff2 (or ttf) at `size`, pinning a variable weight if asked."""
    key = (str(spec), size, weight)
    if key in _cache:
        return _cache[key]

    if spec.suffix == ".woff2":
        try:
            from fontTools.ttLib import TTFont
        except ImportError as exc:  # pragma: no cover - tooling fallback
            raise SystemExit(
                "fonttools is required to read the site's woff2 files: "
                "pip install --break-system-packages fonttools brotli"
            ) from exc
        font = TTFont(spec)
        font.flavor = None
        buffer = BytesIO()
        font.save(buffer)
        buffer.seek(0)
        loaded = ImageFont.truetype(buffer, size)
    else:
        loaded = ImageFont.truetype(str(spec), size)

    if weight is not None:
        try:
            loaded.set_variation_by_axes([weight])
        except Exception:  # static font, or Pillow built without FreeType variations
            pass

    _cache[key] = loaded
    return loaded


def fitted(draw: ImageDraw.ImageDraw, text: str, size: int, max_width: int, italic: bool = False):
    spec = SERIF_ITALIC if italic else SERIF
    while size > 14:
        candidate = load(spec, size)
        if draw.textlength(text, font=candidate) <= max_width:
            return candidate
        size -= 2
    return load(spec, 14)


def tracked(draw: ImageDraw.ImageDraw, xy, text: str, font, colour, tracking: float) -> float:
    """Draw with manual letter spacing; Pillow has no tracking control."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=colour)
        x += draw.textlength(char, font=font) + tracking
    return x


def rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.size[0] - 1, image.size[1] - 1], radius, fill=255)
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def main() -> None:
    card = Image.new("RGB", (1200, 630), PAPER)

    wash = Image.new("RGBA", card.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    wd.ellipse([-260, -320, 620, 380], fill=(236, 227, 213, 170))
    wd.ellipse([820, 420, 1480, 980], fill=(226, 214, 195, 150))
    card = Image.alpha_composite(card.convert("RGBA"), wash)
    draw = ImageDraw.Draw(card)

    # Photograph, cropped to a tall panel on the right.
    photo = Image.open(MEDIA / "project-finished-villa.webp").convert("RGB")
    target_w, target_h = 430, 566
    scale = max(target_w / photo.width, target_h / photo.height)
    photo = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.LANCZOS)
    left = (photo.width - target_w) // 2
    top = (photo.height - target_h) // 2
    photo = rounded(photo.crop((left, top, left + target_w, top + target_h)), 10)
    card.paste(photo, (712, 32), photo)

    # Mark + wordmark, set the way the site sets it.
    mark = Image.open(PUBLIC / "brand" / "mark-512.png").convert("RGBA").resize((88, 88), Image.LANCZOS)
    card.paste(mark, (64, 54), mark)

    word = load(SANS, 34, 800)
    x = 168
    draw.text((x, 62), "OPUDA'S", font=word, fill=GREEN)
    letter = load(SANS, 19, 800)
    x = 168
    for index, char in enumerate("PAINT"):
        draw.text((x, 104), char, font=letter, fill=LETTER_COLOURS[index])
        x += draw.textlength(char, font=letter) + 12
    x += 14
    tracked(draw, (x, 108), "MANUFACTURED IN LAGOS", load(SANS, 13, 700), MUTED, 2.2)

    # Headline in Instrument Serif, italic on the second line.
    column_right = 676
    width = column_right - 64
    line_two = "made in Nigeria."
    head = fitted(draw, line_two, 88, width, italic=True)
    draw.text((62, 196), "Colour,", font=fitted(draw, "Colour,", 88, width), fill=INK)
    draw.text((62, 196 + head.size + 6), line_two, font=head, fill=INK)

    body_top = 196 + (head.size + 6) * 2 + 34
    body_font = load(SANS, 24, 500)
    for index, line in enumerate(
        [
            "Matt and Silk emulsion, guaranteed for five years.",
            "Preview a shade on your own wall before you buy.",
        ]
    ):
        draw.text((66, body_top + index * 34), line, font=body_font, fill=BODY)

    chips_top = body_top + 2 * 34 + 26
    x = 66
    for hex_value in CHIPS:
        chip = rounded(Image.new("RGBA", (52, 52), hex_value), 4)
        card.paste(chip, (x, chips_top), chip)
        ImageDraw.Draw(card).rectangle([x, chips_top, x + 51, chips_top + 51], outline=(11, 26, 19, 40), width=1)
        x += 60
    draw.text((x + 8, chips_top + 15), "+ 53 more", font=load(SANS, 20, 500), fill=MUTED)

    footer_y = chips_top + 76
    card.paste(
        Image.new("RGB", (108, 3), GREEN),
        (66, footer_y - 14),
    )
    draw.text((66, footer_y), "0902 642 4350", font=load(SANS, 23, 700), fill=GREEN)
    site_font = load(SANS, 20, 500)
    draw.text(
        (column_right - draw.textlength("opudapaint.com", font=site_font), footer_y + 4),
        "opudapaint.com",
        font=site_font,
        fill=MUTED,
    )

    out = MEDIA / "og-card.jpg"
    card.convert("RGB").save(out, quality=88, optimize=True, progressive=True)
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
