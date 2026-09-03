/**
 * The Adobe range, built from the VIP channel price list.
 *
 * `data/adobe-price-list.json` holds the public columns of that list —
 * Adobe's India street price per product family, and nothing about what we pay
 * for it. `scripts/import-adobe-price-list.py` produces that file; the
 * workbook itself must never be committed.
 *
 * One thing here differs from the Microsoft range and is worth stating.
 * Adobe prices in volume bands — 1-9 seats, 10-49, 50-99, 100+ — and the
 * price on the shelf is the 1-9 band, because that is what a buyer of a single
 * seat actually pays. The cheaper bands are real, and a customer buying twenty
 * seats through the basket at the single-seat price would be overpaying
 * against Adobe's own list. So every Adobe listing says so and points at a
 * quote. Charging the band price automatically needs quantity-break pricing,
 * which the cart does not do yet; until it does, saying nothing would be the
 * dishonest option.
 */
import priceList from "./data/adobe-price-list.json";
import { inrShelfPrice, usdShelfPrice } from "./pricing";

import type { SeedProduct } from "./catalogue-types";

type PriceRow = (typeof priceList)[number];

/**
 * The publisher's own icons, from the partner asset pack.
 *
 * First match wins, so the narrower name is tested first: "Photoshop
 * Elements" must not be caught by the rule for "Photoshop", and "Lightroom w
 * Classic" is Classic rather than the cloud one.
 */
const LOGO_RULES: [RegExp, string][] = [
  [/photoshop elements/i, "/logos/adobe/photoshop-elements.svg"],
  [/premiere elements/i, "/logos/adobe/premiere-elements.svg"],
  [/lightroom w classic|lightroom classic/i, "/logos/adobe/lightroom-classic.svg"],
  [/lightroom/i, "/logos/adobe/lightroom.svg"],
  [/acrobat/i, "/logos/adobe/acrobat.svg"],
  [/photoshop/i, "/logos/adobe/photoshop.svg"],
  [/illustrator/i, "/logos/adobe/illustrator.svg"],
  [/indesign/i, "/logos/adobe/indesign.svg"],
  [/premiere/i, "/logos/adobe/premiere.svg"],
  [/after effects/i, "/logos/adobe/after-effects.svg"],
  [/animate|flash professional/i, "/logos/adobe/animate.svg"],
  [/audition/i, "/logos/adobe/audition.svg"],
  [/dreamweaver/i, "/logos/adobe/dreamweaver.svg"],
  [/character animator/i, "/logos/adobe/character-animator.svg"],
  [/fresco/i, "/logos/adobe/fresco.svg"],
  [/express/i, "/logos/adobe/express.png"],
  [/firefly/i, "/logos/adobe/firefly.svg"],
  [/stock/i, "/logos/adobe/stock.svg"],
  [/creative cloud/i, "/logos/adobe/creative-cloud.png"],
];

const CATEGORY_RULES: [RegExp, string][] = [
  [/indesign server|coldfusion|robohelp server/i, "servers"],
  [
    /acrobat|sign|incopy|framemaker|robohelp|technical suite|captivate|express/i,
    "productivity",
  ],
];

function logoFor(family: string): string | undefined {
  for (const [pattern, path] of LOGO_RULES) {
    if (pattern.test(family)) return path;
  }
  return undefined;
}

function categoryFor(family: string): string {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(family)) return category;
  }
  return "creative";
}

/** A seat count is a licence, not a pack; these are priced per pack. */
function isConsumption(family: string): boolean {
  return /credit|generative credits|stock for teams|stock for enterprise/i.test(
    family,
  );
}

/** Contracted rather than bought from a basket, and the listing should say so. */
function isEnterprise(family: string): boolean {
  return /for enterprise/i.test(family);
}

function slugify(family: string): string {
  const full = `adobe ${family}`
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (full.length <= 72) return full;
  const cut = full.slice(0, 72);
  const boundary = cut.lastIndexOf("-");
  return (boundary > 40 ? cut.slice(0, boundary) : cut).replace(/-+$/g, "");
}

function summaryFor(row: PriceRow): string {
  if (isEnterprise(row.family)) {
    return `${row.family} — an Adobe VIP enterprise licence on a one-year term. Enterprise agreements are usually quoted rather than bought from a basket; ask us before ordering.`;
  }
  return `${row.family} — a one-year Adobe VIP commercial licence, one named user. Seats are assigned in your Adobe Admin Console.`;
}

function bulletsFor(row: PriceRow): string[] {
  const bullets = [
    "One-year Adobe VIP commercial term",
    "Licensed to one named user, assigned in your Adobe Admin Console",
    "Price shown is Adobe's 1–9 seat band — ask for a quote at 10 seats or more",
  ];
  if (isConsumption(row.family)) {
    bullets.push("Priced per pack rather than per seat");
  }
  if (isEnterprise(row.family)) {
    bullets.push("Enterprise agreement — talk to us before ordering");
  }
  return bullets;
}

export const ADOBE_PRODUCTS: SeedProduct[] = (() => {
  const seen = new Set<string>();

  return priceList.map((row): SeedProduct => {
    let slug = slugify(row.family);
    if (seen.has(slug)) {
      let n = 2;
      while (seen.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    seen.add(slug);

    const inr = inrShelfPrice(row.listExGstMinor);
    const usd = usdShelfPrice(row.listExGstMinor);

    return {
      slug,
      name: `Adobe ${row.family}`,
      brand: "Adobe",
      category: categoryFor(row.family),
      term: "ANNUAL_SUBSCRIPTION",
      summary: summaryFor(row),
      bullets: bulletsFor(row),
      specs: {
        "Licence type": isConsumption(row.family)
          ? "Commercial subscription, per pack"
          : "Commercial subscription, per named user",
        Term: "12 months",
        "Volume band": "Level 1 (1–9 seats). Lower bands are quoted.",
        Delivery: "Electronic — within one business day",
        "Adobe part number": row.partNumber,
      },
      featured: false,
      logo: logoFor(row.family),
      variants: [
        {
          sku: `ADBE-${row.partNumber}`,
          name: isConsumption(row.family) ? "1 pack, 1 year" : "1 seat, 1 year",
          seats: 1,
          // List and price are the same number: the street price is what
          // Adobe publishes, and striking it through against a made-up higher
          // figure would be a fake discount.
          usd: [usd, usd],
          inr: [inr, inr],
        },
      ],
    };
  });
})();
