#!/usr/bin/env python3
"""
Build the social sharing card (1200 x 630).

Social platforms crop a shared link to roughly 1.9:1, so handing them a 4:3
photograph guarantees the product is cut off. This composes a card from the
company's own material instead: the brand mark, one of the site photographs, six
colours from the palette and the two facts a viewer can act on (the guarantee and
the phone number).

Fraunces is not available to Pillow (the app ships woff2, which Pillow cannot
read), so DejaVu Serif stands in for the display face on this one asset. It is a
card, not a brand document — the site itself uses the real typeface.

Run:  python3 tools/build-og.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "app" / "public"
MEDIA = PUBLIC / "media"
FONTS = Path("/usr/share/fonts/truetype/dejavu")

SERIF_BOLD = FONTS / "DejaVuSerif-Bold.ttf"
SANS = FONTS / "DejaVuSans.ttf"
SANS_BOLD = FONTS / "DejaVuSans-Bold.ttf"

INK = (11, 26, 19)
GREEN = (12, 107, 69)
MUTED = (90, 105, 97)
PAPER = (247, 242, 233)

# Six colours that read as a paint range: white, stone, sand, sage, blue, clay.
CHIPS = ["#F8F5EE", "#EBE4D5", "#C9B394", "#6E7F63", "#2F7FA8", "#B4654A"]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.size[0] - 1, image.size[1] - 1], radius, fill=255)
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def fit(draw: ImageDraw.ImageDraw, text: str, path: Path, size: int, max_width: int) -> ImageFont.FreeTypeFont:
    """Largest font size at which `text` fits `max_width`, starting at `size`."""
    while size > 10:
        candidate = font(path, size)
        if draw.textlength(text, font=candidate) <= max_width:
            return candidate
        size -= 2
    return font(path, 10)


def kicker(draw: ImageDraw.ImageDraw, xy, text: str, colour, tracking: int = 3) -> None:
    """Uppercase with manual letter spacing, since Pillow has no tracking."""
    x, y = xy
    f = font(SANS_BOLD, 19)
    for char in text.upper():
        draw.text((x, y), char, font=f, fill=colour)
        x += draw.textlength(char, font=f) + tracking


def main() -> None:
    card = Image.new("RGB", (1200, 630), PAPER)
    draw = ImageDraw.Draw(card)

    # Paper texture: a few soft washes so the background is not a flat block.
    wash = Image.new("RGBA", card.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    wd.ellipse([-260, -320, 620, 380], fill=(236, 227, 213, 170))
    wd.ellipse([820, 420, 1480, 980], fill=(226, 214, 195, 150))
    card = Image.alpha_composite(card.convert("RGBA"), wash)
    draw = ImageDraw.Draw(card)

    # Photograph on the right, cropped to a portrait-ish panel.
    photo = Image.open(MEDIA / "project-finished-villa.webp").convert("RGB")
    target_w, target_h = 430, 566
    scale = max(target_w / photo.width, target_h / photo.height)
    photo = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.LANCZOS)
    left = (photo.width - target_w) // 2
    top = (photo.height - target_h) // 2
    photo = photo.crop((left, top, left + target_w, top + target_h))
    photo = rounded(photo, 10)
    card.paste(photo, (712, 32), photo)

    # Brand mark.
    mark = Image.open(PUBLIC / "brand" / "mark-512.png").convert("RGBA").resize((96, 96), Image.LANCZOS)
    card.paste(mark, (64, 56), mark)

    draw.text((176, 72), "OPUDA'S PAINT", font=font(SERIF_BOLD, 34), fill=GREEN)
    kicker(draw, (178, 116), "Manufactured in Lagos", MUTED, tracking=2)

    # Copy column: everything must clear the photograph at x = 712.
    column_right = 676
    column_width = column_right - 64

    # Headline, fitted so the longest line cannot run under the photo.
    headline = fit(draw, "made in Nigeria.", SERIF_BOLD, 84, column_width)
    draw.text((64, 196), "Colour,", font=headline, fill=INK)
    draw.text((64, 196 + headline.size + 14), "made in Nigeria.", font=headline, fill=INK)

    body_top = 196 + (headline.size + 14) * 2 + 26
    for index, line in enumerate(
        [
            "Matt and Silk emulsion, guaranteed for five years.",
            "Preview a shade on your own wall before you buy.",
        ]
    ):
        body_font = fit(draw, line, SANS, 26, column_width)
        draw.text((66, body_top + index * 36), line, font=body_font, fill=(38, 54, 46))

    # Colour chips: the library in one line.
    chips_top = body_top + 2 * 36 + 22
    x = 66
    for hex_value in CHIPS:
        chip = rounded(Image.new("RGBA", (52, 52), hex_value), 4)
        card.paste(chip, (x, chips_top), chip)
        ImageDraw.Draw(card).rectangle(
            [x, chips_top, x + 51, chips_top + 51], outline=(11, 26, 19, 40), width=1
        )
        x += 60

    draw.text((x + 6, chips_top + 14), "+ 53 more", font=font(SANS, 21), fill=MUTED)

    # Footer line: phone on the left, address right-aligned to the column edge.
    footer_y = chips_top + 76
    phone_font = font(SANS_BOLD, 24)
    draw.text((66, footer_y), "0902 642 4350", font=phone_font, fill=GREEN)
    site_font = font(SANS, 21)
    site_x = column_right - draw.textlength("opudapaint.com", font=site_font)
    draw.text((site_x, footer_y + 4), "opudapaint.com", font=site_font, fill=MUTED)

    out = PUBLIC / "media" / "og-card.jpg"
    card.convert("RGB").save(out, quality=88, optimize=True, progressive=True)
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
