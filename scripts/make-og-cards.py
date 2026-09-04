#!/usr/bin/env python3
"""Build the social and structured-data card for each publisher we sell.

Why these exist at all. A product page has to give Google an `image` in its
structured data and a social platform an `og:image`, and neither will take what
the listings actually show: the icons in `public/logos/` are 256 pixels at
best, and Google's product guidance asks for 1200 or more. Rather than submit a
picture that gets rejected for being small, every listing points at the card
for its publisher until real product photography exists.

Two shapes per publisher, because the two consumers want different ones. Square
is on Google's list of accepted product ratios; 16:9 is what Facebook, LinkedIn
and WhatsApp crop a link preview to. Both are 1200 wide.

Run from the repository root:

    python3 scripts/make-og-cards.py

Needs Pillow. Public Sans is used when a copy is available — pass
`--font-dir` to point at one — and the script says so and falls back to
DejaVu Sans when it is not, which changes the lettering but nothing else.
"""
import argparse
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

NAVY = (12, 29, 46)
WHITE = (255, 255, 255)
AMBER = (255, 206, 79)
MUTED = (150, 168, 182)

PUBLISHERS = ["Microsoft", "Adobe", "Autodesk"]

FONT_CANDIDATES = {
    700: ["PublicSans-700.ttf", "PublicSans-Bold.ttf"],
    500: ["PublicSans-500.ttf", "PublicSans-Medium.ttf"],
}
FALLBACK = {
    700: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    500: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
}


def load_font(weight: int, size: int, font_dir: pathlib.Path | None):
    if font_dir:
        for name in FONT_CANDIDATES[weight]:
            path = font_dir / name
            if path.exists():
                return ImageFont.truetype(str(path), size)
    return ImageFont.truetype(FALLBACK[weight], size)


def card(publisher: str, width: int, height: int, lockup: Image.Image, font_dir):
    im = Image.new("RGB", (width, height), NAVY)
    draw = ImageDraw.Draw(im)

    # The shop's own lockup, top left, at a tenth of the card's width. Small on
    # purpose: the card is about the publisher, and this says who is selling.
    mark = lockup.copy()
    mark.thumbnail((int(width * 0.30), height), Image.LANCZOS)
    margin = int(width * 0.075)
    im.paste(mark, (margin, margin), mark)

    # The publisher, as large as it can be set without crowding the edges.
    size = int(height * 0.17)
    while size > 12:
        font = load_font(700, size, font_dir)
        if draw.textlength(publisher, font=font) <= width - 2 * margin:
            break
        size -= 4
    font = load_font(700, size, font_dir)
    baseline = int(height * 0.52)
    draw.text((margin, baseline), publisher, font=font, fill=WHITE, anchor="ls")

    rule_y = baseline + int(height * 0.055)
    draw.rectangle(
        [margin, rule_y, margin + int(width * 0.10), rule_y + max(3, height // 200)],
        fill=AMBER,
    )

    sub = load_font(500, int(height * 0.052), font_dir)
    draw.text(
        (margin, rule_y + int(height * 0.10)),
        "Genuine licences · authorised reseller",
        font=sub,
        fill=MUTED,
        anchor="ls",
    )
    return im


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--font-dir", type=pathlib.Path, default=pathlib.Path("scripts/fonts"))
    args = ap.parse_args()

    font_dir = args.font_dir if args.font_dir.is_dir() else None
    if font_dir is None:
        print(f"Public Sans not found in {args.font_dir} — using DejaVu Sans.")

    lockup = Image.open("public/brand/vertex-logo-on-dark@2x.png").convert("RGBA")
    out = pathlib.Path("public/og")
    out.mkdir(parents=True, exist_ok=True)

    for publisher in PUBLISHERS:
        slug = publisher.lower()
        for name, (w, h) in {"1x1": (1200, 1200), "16x9": (1200, 675)}.items():
            path = out / f"product-{slug}-{name}.png"
            card(publisher, w, h, lockup, font_dir).save(path, optimize=True)
            print(f"  {path}  {w}x{h}  {path.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
