#!/usr/bin/env python3
"""
Verify that the committed brand assets match what the scripts produce.

    node tools/build-sitemap.mjs
    python3 tools/build-documents.py
    python3 tools/build-icons.py
    python3 tools/build-og.py
    python3 tools/build-fandeck.py
    python3 tools/check-assets.py

Why this exists rather than `git diff --exit-code`: a JPEG is not a document,
it is the output of libjpeg-turbo, and the wheel on a laptop ships a slightly
different build of that library from the one on a CI runner. The same artwork
therefore encodes to a different number of bytes on each machine — the file is
identical on screen and different on disk. A byte check on the social card can
only ever be a coin toss, and a check that fails at random is worse than none.

So the comparison matches the format:

  · JPEG — the decoded pixels are compared and summarised by the mean channel
    difference and the fraction of pixels that moved by more than ten levels.
    A re-encode moves a scattering of edge pixels by a few levels (measured:
    mean 0.25, 0.11% heavy); a recoloured chip moves a whole block (mean 0.80,
    0.36% heavy); moved text is unmistakable (mean 4.0, 3.6% heavy). The
    thresholds below sit in that gap, and the numbers are printed either way so
    a failure explains itself.
  · Everything else — PNG (zlib, deterministic), the PDFs (timestamp pinned in
    the generators) and XML — is compared byte for byte.

Exit status is 1 if anything has drifted, with the file list on stdout; CI turns
that into a comment on the pull request.
"""
import subprocess
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATHS = [
    "app/public/sitemap.xml",
    "app/public/documents",
    "app/public/brand",
    "app/public/media/og-card.jpg",
]

# Tolerance for a re-encoded JPEG. These are calibrated, not guessed — see the
# measurements in the docstring. They pass encoder noise and fail real edits.
JPEG_MAX_MEAN_DELTA = 0.30
JPEG_MAX_HEAVY_FRACTION = 0.2  # per cent of pixels moving more than 10 levels
JPEG_HEAVY_LEVEL = 10


def committed_files(paths: list[str]) -> list[str]:
    """Every file the commit currently holds under these paths."""
    result = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", "HEAD", "--", *paths],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def committed_bytes(path: str) -> bytes | None:
    result = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, capture_output=True)
    return result.stdout if result.returncode == 0 else None


def differing_region(worst: "Image.Image") -> str:
    """Where the difference lives, in per-cent of the card, plus its mean."""
    mask = worst.point(lambda level: 255 if level > JPEG_HEAVY_LEVEL else 0)
    box = mask.getbbox()
    if not box:
        return "no region above the threshold"
    left, top, right, bottom = box
    inner = worst.crop(box)
    histogram = inner.histogram()
    pixels = max(1, inner.width * inner.height)
    mean = sum(i * c for i, c in enumerate(histogram)) / pixels
    return (
        f"region x {left / worst.width:.0%}-{right / worst.width:.0%}, "
        f"y {top / worst.height:.0%}-{bottom / worst.height:.0%} "
        f"(mean {mean:.1f} inside it)"
    )


def jpeg_delta(a: bytes, b: bytes) -> tuple[float, float, str]:
    """Mean channel difference and per-cent of pixels that moved a lot."""
    left = Image.open(BytesIO(a)).convert("RGB")
    right = Image.open(BytesIO(b)).convert("RGB")
    if left.size != right.size:
        return 255.0, 100.0, f"size {left.size} -> {right.size}"

    red, green, blue = ImageChops.difference(left, right).split()
    # Per-pixel worst channel, so a hue shift cannot hide in one band.
    worst = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    histogram = worst.histogram()
    pixels = worst.width * worst.height

    mean_delta = sum(index * count for index, count in enumerate(histogram)) / pixels
    heavy = sum(histogram[JPEG_HEAVY_LEVEL + 1 :]) / pixels * 100
    return mean_delta, heavy, differing_region(worst)


def compare(path: str) -> str | None:
    """None when the file matches, otherwise a one-line description."""
    working = ROOT / path
    if not working.exists():
        return f"{path}: missing — the script that writes it did not run"

    old = committed_bytes(path)
    if old is None:
        return f"{path}: not in the last commit"

    new = working.read_bytes()
    if old == new:
        return None

    if path.lower().endswith((".jpg", ".jpeg")):
        mean_delta, heavy, region = jpeg_delta(old, new)
        if region.startswith("size "):
            return f"{path}: {region}"
        if mean_delta <= JPEG_MAX_MEAN_DELTA and heavy <= JPEG_MAX_HEAVY_FRACTION:
            print(
                f"  ~ {path}: same picture, re-encoded "
                f"(mean {mean_delta:.3f}, heavy {heavy:.3f}%) — not drift"
            )
            return None
        return (
            f"{path}: pixels differ (mean {mean_delta:.3f}, heavy {heavy:.3f}%) "
            f"in {region} — the artwork changed, commit it"
        )

    return f"{path}: {len(old)} -> {len(new)} bytes"


def uncommitted(paths: list[str], committed: list[str]) -> list[str]:
    """
    Generated files that exist but are not in the last commit.

    A drift check that only reads `git ls-tree` cannot see a *new* artefact: the
    file the generator just wrote is untracked, so it is compared to nothing and
    the check passes while the website links to a document that is not in the
    repository. This is the other half of the same question — not "does the
    committed file match its script" but "is every generated file committed".
    """
    known = set(committed)
    found = []
    for path in paths:
        target = ROOT / path
        candidates = sorted(target.rglob("*")) if target.is_dir() else [target]
        for candidate in candidates:
            if not candidate.is_file():
                continue
            relative = candidate.relative_to(ROOT).as_posix()
            if relative not in known:
                found.append(relative)
    return found


def main(argv: list[str]) -> int:
    paths = argv[1:] or DEFAULT_PATHS
    files = committed_files(paths)
    if not files:
        print(f"No committed files under {', '.join(paths)}", file=sys.stderr)
        return 1

    problems = [note for note in (compare(path) for path in files) if note]
    problems += [
        f"{path}: generated but not committed — add it to the same commit"
        for path in uncommitted(paths, files)
    ]

    if problems:
        print("Brand assets are out of date:\n")
        for problem in problems:
            print(f"  · {problem}")
        print(
            "\nRegenerate and commit:\n"
            "  node tools/build-sitemap.mjs\n"
            "  python3 tools/build-documents.py\n"
            "  python3 tools/build-icons.py\n"
            "  python3 tools/build-og.py\n"
            "  python3 tools/build-fandeck.py\n"
            "  python3 tools/build-brochure.py\n"
        )
        return 1

    print(f"{len(files)} committed asset(s) match their scripts")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
