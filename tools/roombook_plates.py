#!/usr/bin/env python3
"""
Photographic plates for the room-scheme book.

A scheme book shows the same room in several colourways. Doing that honestly is
the whole problem: OPUDA'S owns a handful of real site photographs, not a studio
full of styled sets, so the book cannot show ten different bedrooms. What it can
do — and what no competitor's brochure does — is show *one real room* in many
colourways, with the kitchen and the site keeping their actual geometry.

How a wall gets repainted here
-----------------------------

A painted wall in a photograph is (approximately) its reflectance multiplied by
the light falling on it. So for each wall plane:

  1. trace a clip polygon around the plane, in fractions of the image;
  2. flood-fill from seeds inside that clip, with a colour tolerance, so the
     edges follow cornices, sockets and shadows rather than a straight line;
  3. take the photograph's luminance inside the mask, divide by its own mean, and
     clamp the ratio;
  4. multiply the chosen paint by that ratio.

That is closer to what a painter does than a blend mode is. Highlights stay
highlights, corners stay corners, a dark paint goes properly dark — and the
mean-preserving step means the rendered colour at mid-wall is the paint, which
the build asserts.

Everything is deterministic: fixed seeds, fixed tolerance, fixed resampling.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "app" / "public" / "media"


# --------------------------------------------------------------------------- colour

def rgb_of(hex_value: str) -> np.ndarray:
    return np.array([int(hex_value[i : i + 2], 16) for i in (1, 3, 5)], np.float32) / 255.0


def luminance(array: np.ndarray) -> np.ndarray:
    return 0.2126 * array[..., 0] + 0.7152 * array[..., 1] + 0.0722 * array[..., 2]


def contrast(a: str, b: str) -> float:
    def rel(hex_value: str) -> float:
        channels = [int(hex_value[i : i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    la, lb = rel(a), rel(b)
    hi, lo = (la, lb) if la > lb else (lb, la)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------- masks


def clip_polygon(size: tuple[int, int], points: list[tuple[float, float]],
                 feather: float = 1.4) -> np.ndarray:
    """A polygon given in fractions of the image, feathered so the edge is not a cut-out."""
    w, h = size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon([(x * w, y * h) for x, y in points], fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(feather))) > 127


def flood(array: np.ndarray, seed: tuple[int, int], tolerance: int) -> np.ndarray:
    """
    Scanline flood fill with a colour tolerance.

    Iterative, so a 1024px wall cannot blow the stack, and it walks in horizontal
    runs, which is roughly an order of magnitude faster than per-pixel recursion
    on flat plaster — the same approach the browser visualiser uses, ported.
    """
    h, w, _ = array.shape
    mask = np.zeros((h, w), bool)
    base = array[seed[1], seed[0]].astype(np.int16)

    def matches(y: int, x: int) -> bool:
        return int(np.abs(array[y, x].astype(np.int16) - base).max()) <= tolerance

    stack = [seed]
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or mask[y, x] or not matches(y, x):
            continue
        left = x
        while left > 0 and not mask[y, left - 1] and matches(y, left - 1):
            left -= 1
        right = x
        while right < w - 1 and not mask[y, right + 1] and matches(y, right + 1):
            right += 1
        mask[y, left : right + 1] = True
        for row in (y - 1, y + 1):
            if 0 <= row < h:
                cursor = left
                while cursor <= right:
                    if not mask[row, cursor] and matches(row, cursor):
                        stack.append((cursor, row))
                        while cursor <= right and matches(row, cursor):
                            cursor += 1
                    else:
                        cursor += 1
    return mask


def plane_mask(image: Image.Image, plane: dict) -> np.ndarray:
    """Clip polygon ∩ flood fill from each seed."""
    array = np.asarray(image.convert("RGB"))
    clip = clip_polygon(image.size, plane["clip"], plane.get("feather", 1.4))
    if plane.get("whole"):
        # A plane with no flat region to fill (a textured facade, a rendered
        # illustration) is masked by its polygon alone.
        return clip
    mask = np.zeros(array.shape[:2], bool)
    for seed in plane["seeds"]:
        x = min(max(int(seed[0]), 0), image.width - 1)
        y = min(max(int(seed[1]), 0), image.height - 1)
        mask |= flood(array, (x, y), plane.get("tolerance", 30)) & clip
    return mask


# --------------------------------------------------------------------------- painting


def paint_plane(image: Image.Image, mask: np.ndarray, hex_value: str,
                floor: float = 0.42, ceiling: float = 1.28) -> Image.Image:
    """
    Repaint one wall plane.

    `floor` and `ceiling` clamp the luminance ratio. Without a ceiling a window
    highlight multiplied by a pale paint blows to white; without a floor every
    shadow under a cornice turns to mud.
    """
    array = np.asarray(image.convert("RGB")).astype(np.float32) / 255.0
    weight = float(mask.sum()) or 1.0
    alpha = mask.astype(np.float32)
    mean = float((luminance(array) * alpha).sum() / weight)
    ratio = np.clip(luminance(array) / max(mean, 1e-4), floor, ceiling)
    painted = np.clip(rgb_of(hex_value) * ratio[..., None], 0, 1)
    out = array * (1 - alpha[..., None]) + painted * alpha[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def paint(image: Image.Image, planes: list[dict], hexes: list[str]) -> Image.Image:
    """Repaint a plate: one hex per plane, in the same order."""
    out = image.convert("RGB")
    for plane, hex_value in zip(planes, hexes):
        mask = plane_mask(image, plane)
        if not mask.any():
            raise SystemExit(
                f"A plane in plate {plane.get('name')!r} produced an empty mask. "
                "Check its clip and seeds — a silently blank wall is worse than a failed build."
            )
        out = paint_plane(out, mask, hex_value)
    return out


class Plate:
    """
    One photograph and its repaintable planes.

    Masks are computed once and reused for every colourway: a flood fill on a
    780 × 1040 photograph takes a few seconds, and a book of sixteen renders would
    otherwise spend a minute and a half doing the same work sixteen times.
    """

    def __init__(self, key: str, spec: dict) -> None:
        self.key = key
        self.title = spec["title"]
        self.note = spec["note"]
        self.planes = spec["planes"]
        source = MEDIA / f"{spec['image']}.webp"
        if not source.exists():
            raise SystemExit(f"Missing photograph for plate {key!r}: {source}")
        self.image = Image.open(source).convert("RGB")
        self.masks = [plane_mask(self.image, plane) for plane in self.planes]
        self.coverage = [round(float(mask.mean()) * 100, 1) for mask in self.masks]

    def render(self, hexes: list[str]) -> Image.Image:
        if len(hexes) != len(self.planes):
            raise SystemExit(
                f"Plate {self.key!r} has {len(self.planes)} planes but {len(hexes)} colours."
            )
        out = self.image
        for mask, hex_value in zip(self.masks, hexes):
            out = paint_plane(out, mask, hex_value)
        return out

    def coverage_report(self) -> str:
        pairs = ", ".join(f"{p['name']} {c}%" for p, c in zip(self.planes, self.coverage))
        return f"{self.key}: {pairs}"


def load_plates(path: Path | None = None) -> dict[str, "Plate"]:
    path = path or (ROOT / "tools" / "roombook-plates.json")
    spec = json.loads(path.read_text(encoding="utf-8"))
    return {
        key: Plate(key, value)
        for key, value in spec.items()
        if not key.startswith("_")
    }


def encode(image: Image.Image, width_mm: float, height_mm: float,
           focus: float = 0.5, ppi: int = 200) -> "object":
    """
    Crop to the placed aspect ratio and encode once, at 200 ppi.

    Deterministic: same crop, same resample, same quality, every build.
    """
    from io import BytesIO

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
    target = (max(1, round(width_mm / 25.4 * ppi)), max(1, round(height_mm / 25.4 * ppi)))
    if image.size[0] > target[0] and image.size[1] > target[1]:
        image = image.resize(target, Image.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90, optimize=True, progressive=False)
    buffer.seek(0)
    return buffer
