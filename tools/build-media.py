#!/usr/bin/env python3
"""
OPUDA'S PAINT — media pipeline.

Takes the raw WhatsApp photography in /opuda and produces:
  * de-duplicated, semantically named WebP renditions (full + thumb)
  * LQIP base64 blur placeholders (manifest.json)
  * a trimmed, web-compressed project film (mp4) + poster
  * an average-colour reading per image, used to seed UI accents

Run:  python3 tools/build-media.py
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "opuda"
OUT = ROOT / "app" / "public" / "media"
OUT.mkdir(parents=True, exist_ok=True)

# semantic name -> (source filename, optional crop box as fractions (l, t, r, b))
Crop = tuple[float, float, float, float] | str | None

CATALOGUE: dict[str, tuple[str, Crop]] = {
    # --- brand / packaging -------------------------------------------------
    "brand-banner-matt": ("WhatsApp Image 2026-10-21 at 8.46.05 AM.jpeg", "trim"),
    "brand-banner-red": ("WhatsApp Image 2026-10-21 at 8.46.22 AM.jpeg", "trim"),
    "product-matt-bucket": ("WhatsApp Image 2026-10-21 at 3.09.06 PM (1).jpeg", None),
    "product-matt-pail": ("WhatsApp Image 2026-10-21 at 3.09.06 PM.jpeg", None),
    "product-silk-bucket": ("WhatsApp Image 2026-10-21 at 3.09.08 PM.jpeg", None),
    "product-silk-pail": ("WhatsApp Image 2026-10-21 at 3.09.07 PM.jpeg", None),
    # --- exteriors ---------------------------------------------------------
    "project-finished-villa": ("WhatsApp Image 2026-10-21 at 8.46.21 AM.jpeg", None),
    "project-arched-facade": ("WhatsApp Image 2026-10-21 at 3.09.20 PM.jpeg", None),
    "project-porch-blue": ("WhatsApp Image 2026-10-21 at 3.09.30 PM.jpeg", None),
    "project-cream-scaffold": ("WhatsApp Image 2026-10-21 at 3.09.14 PM.jpeg", None),
    "project-corner-scaffold": ("WhatsApp Image 2026-10-21 at 3.09.18 PM.jpeg", None),
    "project-dark-roof": ("WhatsApp Image 2026-10-21 at 8.46.06 AM.jpeg", None),
    "project-stone-brick": ("WhatsApp Image 2026-10-21 at 8.46.21 AM (1).jpeg", None),
    "project-blue-fence": ("WhatsApp Image 2026-10-21 at 8.46.21 AM (2).jpeg", None),
    "project-render-stage": ("WhatsApp Image 2026-10-21 at 3.09.25 PM.jpeg", None),
    "project-painter": ("WhatsApp Image 2026-10-21 at 3.09.31 PM.jpeg", None),
    "project-stone-wall": ("WhatsApp Image 2026-10-21 at 3.09.11 PM.jpeg", None),
    "project-gate": ("WhatsApp Image 2026-10-21 at 3.09.39 PM.jpeg", None),
    # --- interiors ---------------------------------------------------------
    "interior-lilac-lounge": ("WhatsApp Image 2026-10-21 at 3.09.38 PM.jpeg", None),
    "interior-mauve-peach": ("WhatsApp Image 2026-10-21 at 3.09.34 PM.jpeg", None),
    # --- concept renders ---------------------------------------------------
    "render-modern-white": ("WhatsApp Image 2026-10-21 at 8.46.04 AM.jpeg", None),
    "render-modern-grey": ("WhatsApp Image 2026-10-21 at 8.46.05 AM (1).jpeg", None),
    # --- site photography, added 2026-10-27 ---------------------------------
    "project-brick-gate": ("WhatsApp Image 2026-10-27 at 7.19.15 AM.jpeg", None),
    "project-stone-pier": ("WhatsApp Image 2026-10-27 at 7.19.16 AM.jpeg", None),
    "project-mauve-finished": ("WhatsApp Image 2026-10-27 at 7.19.16 AM (1).jpeg", None),
    "project-mauve-scaffold": ("WhatsApp Image 2026-10-27 at 7.19.17 AM.jpeg", None),
    "project-mauve-balcony": ("WhatsApp Image 2026-10-27 at 7.19.19 AM.jpeg", None),
    "interior-gallery-stair": ("WhatsApp Image 2026-10-27 at 7.19.23 AM.jpeg", None),
    "interior-gallery-hall": ("WhatsApp Image 2026-10-27 at 7.19.31 AM.jpeg", None),
    "project-commercial-cladding": ("WhatsApp Image 2026-10-27 at 7.19.32 AM (1).jpeg", None),
    "project-grey-stone-gate": ("WhatsApp Image 2026-10-27 at 7.19.32 AM (2).jpeg", None),
    "project-cream-render-scaffold": ("WhatsApp Image 2026-10-27 at 7.19.32 AM.jpeg", None),
    "project-grey-duplex": ("WhatsApp Image 2026-10-27 at 7.19.33 AM (1).jpeg", None),
    "project-grey-duplex-wall": ("WhatsApp Image 2026-10-27 at 7.19.33 AM (2).jpeg", None),
    "project-grey-stone-pier": ("WhatsApp Image 2026-10-27 at 7.19.33 AM.jpeg", None),
    "interior-pastel-door": ("WhatsApp Image 2026-10-27 at 7.19.34 AM (1).jpeg", None),
    "interior-pastel-marble": ("WhatsApp Image 2026-10-27 at 7.19.34 AM (2).jpeg", None),
    # --- site photography, added 2026-10-27 (second batch) -----------------
    "project-arched-bungalow": ("WhatsApp Image 2026-10-27 at 7.19.34 AM.jpeg", None),
    "project-teal-duplex-courtyard": ("WhatsApp Image 2026-10-27 at 7.19.35 AM.jpeg", None),
    "project-teal-duplex-urn": ("WhatsApp Image 2026-10-27 at 7.19.35 AM (1).jpeg", None),
    "project-teal-duplex-entrance": ("WhatsApp Image 2026-10-27 at 7.19.35 AM (2).jpeg", None),
    "project-mauve-wall-dog": ("WhatsApp Image 2026-10-27 at 7.19.35 AM (3).jpeg", None),
    "interior-pastel-early": ("WhatsApp Image 2026-10-27 at 7.19.36 AM.jpeg", None),
    "project-commercial-aircon": ("WhatsApp Image 2026-10-27 at 7.19.36 AM (1).jpeg", None),
    "project-portico-event": ("WhatsApp Image 2026-10-27 at 7.19.36 AM (2).jpeg", None),
    "project-dormer-elevation": ("WhatsApp Image 2026-10-27 at 7.19.36 AM (3).jpeg", None),
    "project-mauve-gate-dusk": ("WhatsApp Image 2026-10-27 at 7.19.37 AM (1).jpeg", None),
    "project-dormer-elevation-side": ("WhatsApp Image 2026-10-27 at 7.19.37 AM (2).jpeg", None),
    "project-teal-duplex-render": ("WhatsApp Image 2026-10-27 at 7.19.38 AM.jpeg", None),
}

FULL_W = 1500
THUMB_W = 640


def slug_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def lqip(im: Image.Image) -> str:
    """Tiny inline blur placeholder as a base64 WebP data URI."""
    small = im.convert("RGB").resize((24, max(1, round(24 * im.height / im.width))), Image.LANCZOS)
    small = small.filter(ImageFilter.GaussianBlur(0.6))
    buf = io.BytesIO()
    small.save(buf, "WEBP", quality=55, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def trim_black(im: Image.Image, threshold: int = 24) -> Image.Image:
    """Crop away letterboxed black bands from phone screenshots."""
    grey = im.convert("L")
    w, h = grey.size
    px = grey.load()
    def row_lit(y: int) -> bool:
        return any(px[x, y] > threshold for x in range(0, w, 3))
    def col_lit(x: int) -> bool:
        return any(px[x, y] > threshold for y in range(0, h, 3))
    top = next((y for y in range(h) if row_lit(y)), 0)
    bottom = next((y for y in range(h - 1, -1, -1) if row_lit(y)), h - 1)
    left = next((x for x in range(w) if col_lit(x)), 0)
    right = next((x for x in range(w - 1, -1, -1) if col_lit(x)), w - 1)
    return im.crop((left, top, right + 1, bottom + 1))


def dominant(im: Image.Image) -> str:
    """Average colour of the middle band — used to tint image wells while loading."""
    w, h = im.size
    band = im.convert("RGB").crop((0, int(h * 0.3), w, int(h * 0.7)))
    band = band.resize((1, 1), Image.LANCZOS)
    r, g, b = band.getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}"


def main() -> None:
    manifest: dict[str, dict] = {}
    total_in = 0
    total_out = 0

    for name, (filename, crop) in CATALOGUE.items():
        src = SRC / filename
        if not src.exists():
            raise SystemExit(f"missing source image: {src}")
        total_in += src.stat().st_size
        im = Image.open(src).convert("RGB")
        if crop == "trim":
            # phone screenshots arrive letterboxed in black — keep only the artwork
            im = trim_black(im)
        elif crop:
            l, t, r, b = crop
            w, h = im.size
            im = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))

        full = im.copy()
        if full.width > FULL_W:
            full = full.resize((FULL_W, round(FULL_W * full.height / full.width)), Image.LANCZOS)
        thumb = full.copy()
        thumb.thumbnail((THUMB_W, 4000), Image.LANCZOS)

        fpath = OUT / f"{name}.webp"
        tpath = OUT / f"{name}-640.webp"
        full.save(fpath, "WEBP", quality=82, method=6)
        thumb.save(tpath, "WEBP", quality=78, method=6)
        total_out += fpath.stat().st_size + tpath.stat().st_size

        manifest[name] = {
            "src": f"/media/{name}.webp",
            "thumb": f"/media/{name}-640.webp",
            "width": full.width,
            "height": full.height,
            "aspect": round(full.width / full.height, 4),
            "lqip": lqip(im),
            "tint": dominant(im),
        }

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"images: {len(manifest)}  raw {total_in/1024:.0f} KB -> optimised {total_out/1024:.0f} KB")

    # ---- project film -----------------------------------------------------
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg = None

    video_src = SRC / "WhatsApp Video 2026-10-21 at 3.09.40 PM.mp4"
    if ffmpeg and video_src.exists():
        clip = OUT / "project-film.mp4"
        subprocess.run([
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", "20", "-t", "26", "-i", str(video_src),
            "-an", "-vf", "scale=360:640,fps=24",
            "-c:v", "libx264", "-profile:v", "main", "-crf", "27",
            "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(clip),
        ], check=True)
        subprocess.run([
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", "26", "-i", str(video_src), "-frames:v", "1",
            "-vf", "scale=720:1280", "-q:v", "3", str(OUT / "project-film-poster.jpg"),
        ], check=True)
        print("film:", clip.stat().st_size // 1024, "KB")

    # ---- brand marks ------------------------------------------------------
    for size in (180, 512):
        pass  # marks are authored as SVG, no raster needed


if __name__ == "__main__":
    main()
