/**
 * The Microsoft range, built from the distributor price list.
 *
 * `data/microsoft-price-list.json` holds the public columns of the Savex
 * channel price list — Microsoft's India list price per SKU, and nothing about
 * what we pay for it. `scripts/import-price-list.py` produces that file; the
 * workbook itself must never be committed.
 *
 * Two conversions happen here, and both are worth stating plainly because a
 * mistake in either is a mistake on every price in the shop.
 *
 * GST. Microsoft publishes India list prices exclusive of tax; this shop
 * displays them inclusive, because a price shown to an Indian buyer that
 * excludes the tax they will pay is a price that lies. So the shelf price is
 * the list price plus 18%.
 *
 * The dollar price. The price list has no dollar column, so the export price
 * is converted from the rupee figure — before GST, since an export carries
 * none. That makes it a derived number, not Microsoft's published USD list:
 * Microsoft prices India as its own market, so per-SKU margin varies a few
 * percent either way from what the same licence costs in dollars elsewhere.
 * It is a reasonable starting point and not a substitute for the USD price
 * book. When that arrives, this rate stops being load-bearing.
 */
import { MAX_MINOR } from "../src/lib/money";

import { inrShelfPrice, usdShelfPrice } from "./pricing";

import priceList from "./data/microsoft-price-list.json";

import type { SeedProduct } from "./catalogue-types";

export { INR_PER_USD } from "./pricing";

type PriceRow = (typeof priceList)[number];

/**
 * The Microsoft mark, on every Microsoft listing.
 *
 * One mark rather than an icon per product, and that is a decision rather than
 * a shortcut. Microsoft's per-product icon pack we were given is a set of
 * screen captures: the artwork is forty to eighty pixels across inside a large
 * empty canvas, the product's name is baked into the picture, and several are
 * clipped mid-letter. Blown up to the size a listing uses they are soft, they
 * repeat a name the card already prints underneath, and they do not sit
 * together as a set. Four hundred listings wearing the publisher's own mark
 * read as one shop; the same listings wearing four hundred blurry screenshots
 * read as a broken one.
 *
 * A drawing rather than a picture of one, so it is sharp at the size a search
 * result uses and the larger size a product page uses, from a single file of
 * under a kilobyte. Replacing this with real per-product artwork is a change
 * to one line each in `LOGO_RULES`-style rules, the way `adobe.ts` does it —
 * what is missing is the artwork, not the mechanism.
 */
const MICROSOFT_MARK = "/logos/microsoft/microsoft.svg";

/**
 * Which shelf a SKU belongs on, first match winning.
 *
 * Order is doing real work: "Dynamics 365 Customer Insights" is a business
 * application rather than analytics, and "Microsoft 365 E5 Insider Risk
 * Management" is security rather than productivity, so the narrower families
 * are tested before the broader ones.
 */
const CATEGORY_RULES: [RegExp, string][] = [
  [/windows 365|azure virtual desktop|cloud pc/i, "cloud-desktop"],
  [
    /dynamics 365|business central|dataverse|power apps|power automate|power pages|copilot studio|field service|supply chain|contact center|remote assist/i,
    "business-apps",
  ],
  [
    /defender|entra|intune|purview|sentinel|compliance|audit log|ediscovery|information protection|insider risk|privileged identity|data residency|threat|identity governance/i,
    "security",
  ],
  [/windows server|sql server|azure sql|extended security update|\besu\b/i, "servers"],
  [/power bi|fabric|project plan|planner and project|visio/i, "analytics"],
];

/**
 * A SKU that cannot be bought on its own.
 *
 * Microsoft's range is full of these — extra storage, extra capacity, a
 * feature bolted onto a base plan — and selling one to somebody without the
 * base subscription leaves them with a licence that does nothing. The listing
 * says so rather than letting them find out after paying.
 */
function isAddOn(title: string): boolean {
  return /\badd[- ]?on\b|\battach\b|\boverage\b|\baddl\b|\badditional\b|capacity|storage/i.test(
    title,
  );
}

function categoryFor(title: string): string {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(title)) return category;
  }
  return "productivity";
}

/**
 * Microsoft SKU titles run long — "Dynamics 365 Customer Service Professional
 * Attach to Qualifying Dynamics 365 Base Offer" — so a slug is capped. The cap
 * falls back to the last word boundary rather than cutting mid-word, because
 * the URL is read by people.
 */
function slugify(title: string): string {
  const full = title
    .toLowerCase()
    .replace(/[\u2019'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (full.length <= 72) return full;
  const cut = full.slice(0, 72);
  const boundary = cut.lastIndexOf("-");
  return (boundary > 40 ? cut.slice(0, boundary) : cut).replace(/-+$/g, "");
}

/**
 * Editorial copy for the SKUs a customer actually searches for.
 *
 * Everything else gets the generated description below, which is accurate but
 * says only what the price list knows. These few are the shop window, so they
 * keep the copy that was written for them; the prices come from the price list
 * either way.
 */
const EDITORIAL: Record<
  string,
  {
    summary: string;
    bullets: string[];
    specs?: Record<string, string>;
    featured?: boolean;
  }
> = {
  "Microsoft 365 Business Basic": {
    summary:
      "Business email, Teams and the web versions of the Office apps. No desktop installs.",
    bullets: [
      "Business email on your own domain, 50 GB mailbox",
      "Web and mobile versions of Word, Excel, PowerPoint and Outlook",
      "Teams, SharePoint and 1 TB of OneDrive per user",
      "No desktop applications — see Business Standard for those",
    ],
    specs: { Platform: "Web and mobile only" },
    featured: true,
  },
  "Microsoft 365 Business Standard": {
    summary:
      "Desktop Office apps, business email on your own domain, and 1 TB of OneDrive per user.",
    bullets: [
      "Word, Excel, PowerPoint and Outlook installed on up to 5 devices per user",
      "Business email on your own domain with a 50 GB mailbox",
      "1 TB of OneDrive storage per user",
      "Teams, SharePoint and Microsoft Bookings",
    ],
    specs: { Platform: "Windows, macOS, iOS, Android, web" },
    featured: true,
  },
  "Microsoft 365 Business Premium": {
    summary:
      "Everything in Business Standard plus device management and advanced threat protection.",
    bullets: [
      "All of Business Standard, per user",
      "Intune device management for company and personal devices",
      "Microsoft Defender for Office 365 and Entra ID Plan 1",
      "Conditional access and data loss prevention",
    ],
    specs: { "Seat cap": "300 users" },
    featured: true,
  },
  "Microsoft 365 Apps for business": {
    summary:
      "The desktop Office applications, without the hosted email. For teams that already have mail elsewhere.",
    bullets: [
      "Word, Excel, PowerPoint, Outlook and OneNote on up to 5 devices per user",
      "1 TB of OneDrive storage per user",
      "No hosted email — use your existing provider",
      "No Teams; see Business Basic or Standard for that",
    ],
    specs: { Platform: "Windows, macOS, iOS, Android" },
    featured: true,
  },
  "Microsoft 365 E3": {
    summary:
      "Enterprise licensing with no 300-seat cap, plus compliance, eDiscovery and Windows Enterprise rights.",
    bullets: [
      "No seat cap, unlike the Business plans",
      "Windows 11 Enterprise E3 upgrade rights",
      "Information protection, retention and eDiscovery (Standard)",
      "100 GB mailbox and unlimited archive",
    ],
    specs: { "Seat cap": "None" },
    featured: true,
  },
  "Office 365 E3": {
    summary:
      "The Office applications and enterprise services, without the Windows and Intune rights of Microsoft 365 E3.",
    bullets: [
      "Office apps on up to 5 devices per user, no seat cap",
      "100 GB mailbox, unlimited archive",
      "SharePoint, Teams and Power Apps for Office 365",
      "No Windows Enterprise upgrade rights — see Microsoft 365 E3",
    ],
    featured: true,
  },
  "Exchange Online (Plan 1)": {
    summary:
      "Business email on your own domain, with a 50 GB mailbox, and nothing else.",
    bullets: [
      "50 GB mailbox on your own domain",
      "Outlook on the web, plus any IMAP or ActiveSync client",
      "Anti-spam and anti-malware filtering",
      "No Office applications",
    ],
    specs: { "Licence type": "Commercial subscription, per mailbox" },
  },
  "Power BI Pro": {
    summary:
      "Publish, share and collaborate on reports and dashboards, per user, per year.",
    bullets: [
      "Publish reports to shared workspaces",
      "Collaborate on dashboards and paginated reports",
      "Refresh datasets up to eight times a day",
      "Row-level security",
    ],
    specs: { Platform: "Windows, web, mobile" },
    featured: true,
  },
  "Visio Plan 2": {
    summary:
      "Diagramming with the Visio desktop app, data-linked shapes and web publishing.",
    bullets: [
      "Visio desktop app installed on up to 5 devices",
      "Data-linked diagrams from Excel and Power BI",
      "Publish and share diagrams on the web",
      "2 GB of Visio-specific storage",
    ],
    specs: { Platform: "Windows desktop and web" },
  },
  "Planner and Project Plan 3": {
    summary:
      "Desktop and web project management with resource levelling and roadmaps.",
    bullets: [
      "Project desktop client plus the web app",
      "Resource management and levelling",
      "Roadmaps across multiple projects",
      "Submit and track timesheets",
    ],
    specs: { Platform: "Windows desktop and web" },
  },
  "Power Automate Premium": {
    summary:
      "Automate workflows across systems, with desktop RPA and premium connectors.",
    bullets: [
      "Cloud flows plus attended and unattended desktop RPA",
      "Premium and on-premises connectors",
      "Process mining",
      "AI Builder credits included",
    ],
  },
};

function generatedSummary(row: PriceRow): string {
  if (isAddOn(row.title)) {
    return `${row.title} — an add-on to an existing Microsoft subscription, on a one-year commercial term. It needs a qualifying base licence on the same tenant and does nothing on its own.`;
  }
  return `${row.title} on a one-year Microsoft commercial subscription, issued to your account as soon as payment clears.`;
}

function generatedBullets(row: PriceRow): string[] {
  const bullets = [
    "One-year commercial term",
    row.billing === "OneTime"
      ? "Charged once for the year"
      : "Billed annually, paid up front",
    "Licence details issued to your Vertex account the moment payment clears",
  ];
  if (isAddOn(row.title)) {
    bullets.push("Requires a qualifying base subscription on the same tenant");
  }
  return bullets;
}

/**
 * SKUs the price book lists but this shop cannot hold.
 *
 * Money is stored in 32-bit columns, so a price above `MAX_MINOR` — a little
 * over two crore rupees — cannot be written at all. A handful of Dynamics
 * commerce SKUs run to three and four crore a year. Dropping them is honest:
 * nothing that large was ever going to be bought with a card on a web page,
 * and a listing whose price cannot be recorded is a listing that fails at
 * checkout. The seed names them so the omission is visible rather than
 * silent.
 */
export const MICROSOFT_TOO_LARGE: { title: string; inr: number }[] = [];

export const MICROSOFT_PRODUCTS: SeedProduct[] = (() => {
  const seen = new Set<string>();

  return priceList.flatMap((row): SeedProduct[] => {
    const editorial = EDITORIAL[row.title];

    const inr = inrShelfPrice(row.listExGstMinor);
    const usd = usdShelfPrice(row.listExGstMinor);

    // The seed writes these as paise and cents. Tested before the slug is
    // claimed, so a dropped SKU does not push a suffix onto the next one.
    if (inr * 100 > MAX_MINOR || usd * 100 > MAX_MINOR) {
      MICROSOFT_TOO_LARGE.push({ title: row.title, inr });
      return [];
    }

    // Titles are unique in the price list today, but a slug is truncated and a
    // future list may not be, so a collision degrades to a suffix rather than
    // to one product quietly overwriting another.
    let slug = slugify(row.title);
    if (seen.has(slug)) {
      let n = 2;
      while (seen.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    seen.add(slug);

    return [{
      slug,
      name: row.title,
      brand: "Microsoft",
      category: categoryFor(row.title),
      term: "ANNUAL_SUBSCRIPTION",
      logo: MICROSOFT_MARK,
      summary: editorial?.summary ?? generatedSummary(row),
      bullets: editorial?.bullets ?? generatedBullets(row),
      specs: {
        "Licence type": "Commercial subscription",
        Term: "12 months",
        Billing:
          row.billing === "OneTime" ? "Once, for the year" : "Annual, paid up front",
        Delivery: "Electronic — within one business day",
        "Microsoft tenant": "A new tenant is created for this order",
        "Microsoft product ID": row.productId,
        "Microsoft SKU ID": row.skuId,
        ...editorial?.specs,
      },
      featured: editorial?.featured ?? false,
      // Every SKU in this price list is bought through CSP, so every one of
      // them arrives in a tenant Microsoft creates for the order.
      cspNewTenant: true,
      // One SKU, one line. Multiples are a quantity rather than a separate
      // product: the price list prices a single licence and the basket
      // multiplies it, so inventing a "5 seats" variant would only invent a
      // discount that Microsoft does not give.
      variants: [
        {
          sku: `MS-${row.productId}-${row.skuId}`,
          // Microsoft's own identity for a CSP catalogue item, written the way
          // Microsoft writes it: the price list carries ProductId and SkuId in
          // two columns, and a partner quotes them joined by a colon. Both
          // values are verbatim from the sheet.
          partNumber: `${row.productId}:${row.skuId}`,
          name: "1 licence, 1 year",
          seats: 1,
          // List and price are the same number. The list price is what
          // Microsoft publishes, and striking it through against a made-up
          // higher figure would be a fake discount.
          usd: [usd, usd],
          inr: [inr, inr],
        },
      ],
    }];
  });
})();
