#!/usr/bin/env python3
"""
Generate the raster launcher icons for API 24 and 25.

Adaptive icons (`res/mipmap-anydpi-v26/`) cover Android 8.0 and newer, and the
vector foreground they point at is committed rather than generated, because a
VectorDrawable is text and belongs in review. What is left is the two API levels
below that, which need a PNG per density and cannot read a vector from
`mipmap/`.

The alternative to generating them is either dropping support for Android 7 —
a market where a seven-year-old mid-range phone is still a phone — or opening
an image editor, which produces a file nobody can regenerate and a mark that
drifts from `app/public/brand/mark.svg` the first time the brand is touched.

So the geometry below is the SVG's geometry: same 48 x 40 viewBox, same five
shapes, same order, same colours. Drawn at four times the target size and
resampled, because a roof line drawn at 48 px and left at 48 px is a staircase.

    python3 tools/build-android-icons.py

Output is deterministic (no timestamps, no metadata beyond PNG's minimum), so
`tools/check-assets.py` can compare it byte for byte.
"""

from __future__ import annotations

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: python3 -m pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# Launcher icon size per density bucket, in pixels. These are the platform's
# numbers, not a choice.
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# The mark's own coordinate space, from brand/mark.svg's viewBox.
VIEW_W, VIEW_H = 48.0, 40.0

GREEN = "#0C6B45"
PAPER = "#F7F2E9"
PAPER_2 = "#FCF9F3"
CRIMSON = "#C1121F"
ORANGE = "#EE6C22"

# How much of the icon the mark fills. A legacy launcher icon is not masked by
# the system, so it can use more of the canvas than the 66/108 adaptive-icon safe
# zone — but not all of it, or the roof line touches the edge of a circular mask
# on launchers that apply one anyway.
FILL = 0.80

SUPERSAMPLE = 4


def mark_geometry(size: int) -> tuple[float, float, float]:
    """Scale and offset that put the 48 x 40 mark into a `size` px canvas."""
    scale = (size * FILL) / VIEW_W
    width = VIEW_W * scale
    height = VIEW_H * scale
    offset_x = (size - width) / 2.0
    # Optical rather than geometric centring: the mark is roof-heavy at the top
    # and flat-bottomed, so sitting it exactly in the middle reads as low.
    offset_y = (size - height) / 2.0 - size * 0.02
    return scale, offset_x, offset_y


def point(scale: float, ox: float, oy: float, x: float, y: float) -> tuple[float, float]:
    return (ox + x * scale, oy + y * scale)


def draw_mark(draw: "ImageDraw.ImageDraw", size: int) -> None:
    """The five shapes of brand/mark.svg, in its own coordinate space."""
    scale, ox, oy = mark_geometry(size)
    p = lambda x, y: point(scale, ox, oy, x, y)  # noqa: E731

    # Roof line: a shallow triangle with a flat underside.
    draw.polygon(
        [p(24, 3.4), p(46.5, 20.2), p(46.5, 21.6), p(1.5, 21.6), p(1.5, 20.2)],
        fill=GREEN,
    )

    # Pail body, with the SVG's 1.1-unit rounded bottom corners.
    left, top = p(10, 19.6)
    right, bottom = p(38, 37.3)
    radius = 1.1 * scale
    draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=GREEN)

    # Paper label on the pail, then the crimson brush stroke on the label.
    draw.rectangle([*p(20.5, 25.5), *p(27.5, 37.3)], fill=PAPER_2)
    draw.rectangle([*p(21.6, 26.6), *p(26.4, 37.3)], fill=CRIMSON)

    # The orange dot: one of the four colour dots from the tin.
    cx, cy = p(41.4, 8.4)
    r = 2.3 * scale
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ORANGE)


def build(size: int, circular: bool) -> Image.Image:
    """One icon, drawn large and resampled down."""
    edge = size * SUPERSAMPLE
    image = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if circular:
        draw.ellipse([0, 0, edge - 1, edge - 1], fill=PAPER)
    else:
        # A squircle-ish rounded square: what most launchers drew for API < 26
        # icons that were not circular, and what the Play Store listing shows.
        draw.rounded_rectangle(
            [0, 0, edge - 1, edge - 1], radius=edge * 0.18, fill=PAPER
        )

    draw_mark(draw, edge)
    return image.resize((size, size), Image.LANCZOS)


def main() -> int:
    written = 0
    for density, size in DENSITIES.items():
        folder = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(folder, exist_ok=True)
        for name, circular in (("ic_launcher.png", False), ("ic_launcher_round.png", True)):
            path = os.path.join(folder, name)
            build(size, circular).save(path, "PNG", optimize=True)
            written += 1
            print(f"  {os.path.relpath(path, ROOT)}  {size}x{size}")
    print(f"android launcher icons: {written} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
