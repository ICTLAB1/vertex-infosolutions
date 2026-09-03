# Vertex Infosolutions logo

Generated from the header artwork, not redrawn: same chevron path, same Public
Sans weights and sizes, same Tailwind tracking. The lettering is converted to
outlines, so the files need no font installed.

| File | Use |
| --- | --- |
| `vertex-logo-on-dark.svg` | Full lockup for a dark background. Transparent. |
| `vertex-logo-on-light.svg` | Full lockup for a light background. Transparent. |
| `vertex-logo-navy.svg` | Full lockup with the site's navy behind it, as in the header. |
| `vertex-wordmark-on-*.svg` | Mark and "vertex" only, without "infosolutions". For narrow spaces. |
| `vertex-mark.svg` | The chevron alone, transparent. |
| `vertex-app-icon.svg` | The chevron on a rounded navy tile. Favicons, avatars, app icons. |
| `*.png` | The same artwork rasterised, for anything that will not take an SVG. |

Prefer the SVG. The PNGs are there for tools that refuse vector — an email
signature, a marketplace listing, a purchase-order template.

Colours: chevron `#ffce4f`, wordmark `#ffffff` on dark or `#0d1b24` on light,
"infosolutions" at 55% white on dark or `#556670` on light, navy `#0c1d2e`.

Regenerate with `scripts/make-logo.py` if the header ever changes.
