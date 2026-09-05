import "server-only";

/**
 * The site's own address, and the things that depend on knowing it.
 *
 * `APP_URL` is configuration rather than something read from the request,
 * because a `Host` header is attacker-controlled — the same reason Stripe's
 * return URL is built from it. A canonical tag or a sitemap built from an
 * attacker-supplied host is worse than none: it invites a copy of this shop on
 * another domain to be indexed as the original.
 */
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absolute(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The shared social-preview image. Whatever links here shows the wordmark. */
export const OG_IMAGE = {
  url: "/brand/vertex-logo-navy@2x.png",
  width: 900,
  height: 170,
  alt: "Vertex Infosolutions",
};

/**
 * The picture a search engine and a social platform are given for a listing.
 *
 * Neither will take what the page itself shows. The icons under
 * `public/logos/` are 256 pixels at their largest — they exist to mark a
 * listing in a grid — and Google's product guidance asks for 1200 or more; a
 * smaller one is not a small picture in the results, it is a rich result that
 * is rejected. So until there is real product photography, a listing points at
 * the card for its publisher, built by `scripts/make-og-cards.py`.
 *
 * Two shapes, because the two consumers crop differently: square is on
 * Google's list of accepted product ratios, and 16:9 is what a link preview
 * becomes on Facebook, LinkedIn and WhatsApp. Both are offered, best first,
 * and something is always offered — a `Product` with no `image` is the single
 * most common reason a listing is dropped from shopping results.
 */
const CARD_BRANDS = ["microsoft", "adobe", "autodesk"];

export function productImages(product: {
  logo: string | null;
  brand: { slug: string };
}): { primary: string; all: string[]; social: string } {
  // Only a raster. An SVG is sharp on the page and invisible in a social
  // preview — no platform renders one — so a listing whose icon is vector
  // falls through to its publisher's card rather than to a blank rectangle.
  const own =
    product.logo && /\.(png|jpe?g|webp)$/i.test(product.logo)
      ? product.logo
      : null;

  const brand = product.brand.slug;
  const square = CARD_BRANDS.includes(brand)
    ? `/og/product-${brand}-1x1.png`
    : null;
  const wide = CARD_BRANDS.includes(brand)
    ? `/og/product-${brand}-16x9.png`
    : null;

  // Google first: the listing's own picture if it has one, then the square
  // card. The shop's wordmark is the last resort and appears only when there
  // is nothing else — it is 900 pixels wide and says nothing about the
  // product, so it is a floor rather than a choice.
  const schema = [own, square, wide].filter(
    (path): path is string => Boolean(path),
  );
  const all = schema.length > 0 ? schema : [OG_IMAGE.url];

  // Social platforms crop a preview to 16:9, so they are given that one
  // first — a square card in a link preview is cropped through the middle of
  // the lettering.
  const social = wide ?? own ?? OG_IMAGE.url;

  return {
    primary: absolute(all[0]),
    all: all.map(absolute),
    social: absolute(social),
  };
}

/**
 * How long the price on this page can be believed.
 *
 * Google wants an expiry on an offer and treats a missing one as a warning.
 * The end of the current year is the honest answer here: publisher price books
 * are reissued annually, and this shop reseeds from a new one when they are.
 */
export function priceValidUntil(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-12-31`;
}

/**
 * What kind of software a listing is, in schema.org's vocabulary.
 *
 * Every product here is software, and saying so is worth more than it looks:
 * a `Product` alone tells a search engine this is a thing with a price, while
 * `SoftwareApplication` tells it what the thing does. That is what lets a
 * listing be understood as "Adobe Photoshop, a design application" rather than
 * as a string of words that happens to cost $138 — which is the difference
 * between competing on price alone and competing on being the right answer.
 *
 * Mapped from the shelf a product sits on, because that is the only statement
 * of category this shop actually holds. An unmapped shelf gets nothing rather
 * than a guess: a wrong `applicationCategory` is worse than none, since it
 * teaches the wrong association.
 */
const APPLICATION_CATEGORIES: Record<string, string> = {
  productivity: "BusinessApplication",
  creative: "DesignApplication",
  cad: "DesignApplication",
  servers: "BusinessApplication",
  analytics: "BusinessApplication",
  "business-apps": "BusinessApplication",
  security: "SecurityApplication",
  "cloud-desktop": "BusinessApplication",
};

export function applicationCategory(categorySlug: string): string | null {
  return APPLICATION_CATEGORIES[categorySlug] ?? null;
}

/**
 * The platforms a licence runs on, read from the listing's own spec table.
 *
 * Only ever what the price book said. A subscription whose specs do not name a
 * platform gets no `operatingSystem` at all, because "Windows, macOS" written
 * by a developer who assumed is a claim this shop cannot stand behind — and it
 * is exactly the sort of claim a buyer checks after it has stopped working.
 */
export function operatingSystems(specs: unknown): string | null {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return null;
  const platform = (specs as Record<string, unknown>)["Platform"];
  return typeof platform === "string" && platform.trim().length > 0
    ? platform.trim()
    : null;
}

/**
 * JSON-LD, rendered into a script tag.
 *
 * Serialised with the closing-brace sequence escaped: a product name
 * containing `</script>` would otherwise end the tag early and put the rest of
 * the payload into the document as markup.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Metadata for an ordinary public page.
 *
 * Every indexable page needs three things and most of them had none: a title,
 * a description a human would click, and a canonical URL. The canonical is the
 * one that does real work — without it the same page reached by two paths, or
 * with a tracking parameter on the end, competes with itself.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website" as const,
      title,
      description,
      url: path,
      images: [OG_IMAGE],
    },
  };
}

/**
 * Keep a page out of the index.
 *
 * `robots.txt` stops a crawler *reading* a page; it does not stop the URL
 * being indexed from a link elsewhere, which is how an empty basket ends up in
 * search results with no description under it. This says the other half.
 *
 * `follow` stays on: a crawler should not index the basket, but the links out
 * of it to the catalogue are worth following.
 */
export const NOINDEX = {
  robots: { index: false, follow: true },
} as const;
