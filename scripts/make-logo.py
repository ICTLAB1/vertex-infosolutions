#!/usr/bin/env python3
"""Build the Vertex wordmark as standalone artwork.

The header draws the logo in live text and an inline path. A logo *file* has to
survive without the font, so the lettering is converted to outlines here using
the same Public Sans weights, the same sizes and the same Tailwind tracking the
site applies.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

AMBER = "#ffce4f"
INK = "#0d1b24"
MUTED = "#556670"
NAVY = "#0c1d2e"

def outline(text, ttf_path, size_px, tracking_em):
    """Return (svg path data, advance width) with the baseline at y=0."""
    font = TTFont(ttf_path)
    upem = font["head"].unitsPerEm
    scale = size_px / upem
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]
    tracking = tracking_em * size_px

    parts, x = [], 0.0
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        # Flip y (font space is up-positive, SVG is down-positive) and scale.
        glyphs[name].draw(TransformPen(pen, Transform(scale, 0, 0, -scale, x, 0)))
        d = pen.getCommands()
        if d:
            parts.append(d)
        x += hmtx[name][0] * scale
        if i < len(text) - 1:
            x += tracking
    return " ".join(parts), x

# The mark, exactly as the header draws it: viewBox 0 0 26 20, 3-unit round
# stroke, so the ink spans 0.5..25.5 by 0.5..19.5.
MARK = ('<path d="M2 18L13 2l11 16" fill="none" stroke="{c}" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round"/>')

def lockup(word_fill, sub_fill, background=None, with_sub=True):
    word, word_w = outline("vertex", "fonts/PublicSans-700.ttf", 21, -0.025)
    sub, sub_w = outline("infosolutions", "fonts/PublicSans-500.ttf", 11, 0.025)

    pad = 8
    gap = 6
    mark_w, mark_h = 26, 20

    # Baseline chosen so the mark, centred on it, clears the padding.
    baseline = pad + 16
    mark_y = baseline - 16 - (mark_h - 20) / 2   # mark box top

    x = pad
    body = []
    if background:
        body.append(f'<rect width="100%" height="100%" fill="{background}"/>')
    body.append(f'<g transform="translate({x} {mark_y})">' + MARK.format(c=AMBER) + "</g>")
    x += mark_w + gap
    body.append(f'<path transform="translate({x:.2f} {baseline})" d="{word}" fill="{word_fill}"/>')
    x += word_w
    if with_sub:
        x += gap
        # The header sets this at 55% white; carried through so the file
        # matches the site rather than merely resembling it.
        opacity = ' fill-opacity="0.55"' if sub_fill == "#ffffff" else ""
        body.append(f'<path transform="translate({x:.2f} {baseline})" d="{sub}" fill="{sub_fill}"{opacity}/>')
        x += sub_w

    # Trim to the ink rather than to the type's line box. Neither "vertex" nor
    # "infosolutions" has a descender, so the lowest ink is the mark's rounded
    # foot; padding it equally top and bottom is what lets somebody drop the
    # file into a layout and have it sit where they put it.
    ink_top = min(mark_y + 0.5, baseline - 21 * 0.75)
    ink_bottom = mark_y + mark_h - 0.5
    shift = pad - ink_top
    body = [b if b.startswith("<rect") else f'<g transform="translate(0 {shift:.2f})">{b}</g>'
            for b in body]
    w = round(x + pad, 2)
    h = round(ink_bottom + shift + pad, 2)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}" role="img" aria-label="Vertex Infosolutions">\n  '
            + "\n  ".join(body) + "\n</svg>\n")

def mark_only(background=None, size=512):
    body = []
    if background:
        body.append(f'<rect width="{size}" height="{size}" rx="{size*0.18:.0f}" fill="{background}"/>')
    inner = size * 0.56
    s = inner / 26
    tx = (size - inner) / 2
    ty = (size - 20 * s) / 2
    body.append(f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})">' + MARK.format(c=AMBER) + "</g>")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
            f'width="{size}" height="{size}" role="img" aria-label="Vertex Infosolutions">\n  '
            + "\n  ".join(body) + "\n</svg>\n")

import pathlib
out = pathlib.Path("brand"); out.mkdir(exist_ok=True)
files = {
    "vertex-logo-on-dark.svg":  lockup("#ffffff", "#ffffff", None),
    "vertex-logo-on-light.svg": lockup(INK, MUTED, None),
    "vertex-logo-navy.svg":     lockup("#ffffff", "#ffffff", NAVY),
    "vertex-wordmark-on-dark.svg":  lockup("#ffffff", "#ffffff", None, with_sub=False),
    "vertex-wordmark-on-light.svg": lockup(INK, MUTED, None, with_sub=False),
    "vertex-mark.svg":       mark_only(None),
    "vertex-app-icon.svg":   mark_only(NAVY),
}
for name, svg in files.items():
    (out / name).write_text(svg, encoding="utf-8")
    print(f"  {name:32} {len(svg):>6} bytes")
