#!/usr/bin/env python3
"""
Rasterise the brand mark into the app icon set.

The mark is drawn from the same geometry as public/brand/mark.svg so the SVG,
the PNG icons and the on-site logo can never drift apart. Pillow is used rather
than a browser or cairosvg, because neither is available in this environment.

Run:  python3 tools/build-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)

PAPER = (252, 249, 243, 255)
GREEN = (12, 107, 69, 255)
CRIMSON = (193, 18, 31, 255)
ORANGE = (238, 108, 34, 255)

# Geometry in the mark's own 48 x 40 coordinate space.
ROOF = [(24, 3.4), (46.5, 20.2), (46.5, 21.6), (1.5, 21.6), (1.5, 20.2)]
BODY = [(10, 19.6), (38, 19.6), (38, 37.3), (10, 37.3)]
DOOR_PAPER = [(20.5, 25.5), (27.5, 25.5), (27.5, 37.3), (20.5, 37.3)]
DOOR = [(21.6, 26.6), (26.4, 26.6), (26.4, 37.3), (21.6, 37.3)]
SUN = (41.4, 8.4, 2.3)

SS = 4  # supersample factor for clean edges


def render(size: int, background: tuple | None, padding: float) -> Image.Image:
    width = height = size
    canvas = Image.new("RGBA", (width * SS, height * SS), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    inner = size * (1 - padding * 2) * SS
    scale = min(inner / 48, inner / 40)
    offset_x = (width * SS - 48 * scale) / 2
    offset_y = (height * SS - 40 * scale) / 2

    def point(xy):
        return (offset_x + xy[0] * scale, offset_y + xy[1] * scale)

    draw.polygon([point(p) for p in ROOF], fill=GREEN)
    draw.polygon([point(p) for p in BODY], fill=GREEN)
    draw.polygon([point(p) for p in DOOR_PAPER], fill=PAPER)
    draw.polygon([point(p) for p in DOOR], fill=CRIMSON)

    cx, cy = point((SUN[0], SUN[1]))
    r = SUN[2] * scale
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ORANGE)

    return canvas.resize((width, height), Image.LANCZOS)


def write(name: str, size: int, background: tuple | None, padding: float) -> None:
    image = render(size, background, padding)
    image.save(OUT / name, optimize=True)
    print(f"wrote {name} ({size}x{size})")


def main() -> None:
    # Maskable / home-screen icons need a solid background: transparent icons
    # render as a black square on Android.
    write("icon-192.png", 192, PAPER, 0.16)
    write("icon-512.png", 512, PAPER, 0.16)
    write("apple-touch-icon.png", 180, PAPER, 0.14)
    # Social card mark, used where a square transparent asset is required.
    write("mark-512.png", 512, None, 0.08)


if __name__ == "__main__":
    main()
