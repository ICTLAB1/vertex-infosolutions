import { cache } from "react";

import "server-only";

import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";

/**
 * The shape every product card and detail page reads from.
 *
 * Prices are filtered to the visitor's currency in the query rather than
 * loaded wholesale and picked in code, so a page cannot accidentally render a
 * figure from the other market. A variant with no row for that currency comes
 * back with an empty `prices` array and is treated as not sold there — which is
 * the truth, not an error.
 */
/**
 * What the shop is willing to show.
 *
 * A withdrawn product keeps its slug, its orders and its history and simply
 * stops being offered. Every catalogue query composes this rather than
 * repeating `published: true`, because the one query that forgot it would put
 * a listing back on sale that somebody deliberately took down.
 */
export const ON_SALE = { published: true } as const;

export function productSelect(currency: CurrencyCode) {
  return {
    id: true,
    slug: true,
    name: true,
    kind: true,
    summary: true,
    bullets: true,
    specs: true,
    sacCode: true,
    gstRatePercent: true,
    term: true,
    glyph: true,
    logo: true,
    featured: true,
    cspNewTenant: true,
    quoteOnly: true,
    brand: { select: { name: true, slug: true } },
    category: { select: { name: true, slug: true } },
    variants: {
      select: {
        id: true,
        sku: true,
        partNumber: true,
        name: true,
        seats: true,
        prices: {
          where: { currency },
          select: { currency: true, listMinor: true, priceMinor: true },
        },
      },
      orderBy: { seats: "asc" },
    },
    reviews: { select: { rating: true } },
  } as const;
}

export type ListedProduct = Awaited<ReturnType<typeof getFeatured>>[number];
export type ListedVariant = ListedProduct["variants"][number];

/** The price in the requested currency, or null when not sold there. */
export function priceOf(variant: { prices: { listMinor: number; priceMinor: number }[] }) {
  return variant.prices[0] ?? null;
}

/** Variants actually purchasable in this market. */
export function sellableVariants<T extends { prices: unknown[] }>(
  variants: T[],
): T[] {
  return variants.filter((variant) => variant.prices.length > 0);
}

/**
 * Whether this product belongs in the market at all.
 *
 * Two different absences look identical in the data and mean opposite things.
 * A priced product with no row in this currency is not sold here, and hiding
 * it is right. A quote-only product has no row in any currency by design —
 * it is sold everywhere, at a price we have to be asked for — and hiding it
 * would take a whole publisher off the shelf.
 */
export function isListable<T extends { quoteOnly: boolean; variants: { prices: unknown[] }[] }>(
  product: T,
): boolean {
  return product.quoteOnly || sellableVariants(product.variants).length > 0;
}

/**
 * One listing, with everything its page shows.
 *
 * Memoised per request. A product page asks for this twice — once in
 * `generateMetadata` to build the title, description and social card, and
 * again in the page itself — and they are the same question with the same
 * answer. Without this every product view is two identical queries carrying
 * the variants, the prices and the reviews.
 */
export const getProduct = cache(async function getProduct(
  slug: string,
  currency: CurrencyCode,
) {
  return prisma.product.findUnique({
    where: { slug, ...ON_SALE },
    select: {
      ...productSelect(currency),
      reviews: {
        select: {
          id: true,
          author: true,
          country: true,
          rating: true,
          title: true,
          body: true,
          verified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
});

export type CatalogueProduct = Awaited<ReturnType<typeof getProduct>>;

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { position: "asc" } });
}

export async function getBrands() {
  return prisma.brand.findMany({
    where: { products: { some: ON_SALE } },
    orderBy: { name: "asc" },
  });
}

export async function getFeatured(currency: CurrencyCode) {
  return prisma.product.findMany({
    where: { featured: true, ...ON_SALE },
    select: productSelect(currency),
    orderBy: { createdAt: "asc" },
  });
}

export async function getByBrand(slug: string, currency: CurrencyCode, take = 8) {
  return prisma.product.findMany({
    where: { brand: { slug }, ...ON_SALE },
    select: productSelect(currency),
    take,
    orderBy: { createdAt: "asc" },
  });
}

export async function getByCategory(
  slug: string,
  currency: CurrencyCode,
  take = 8,
) {
  return prisma.product.findMany({
    where: { category: { slug }, ...ON_SALE },
    select: productSelect(currency),
    take,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Other listings worth seeing from this one.
 *
 * Internal links, and they are not decoration. Every product page was reachable
 * only from the shelf that lists it, so authority arrived at a product and
 * stopped there — and a shopper who landed on Photoshop from a search had no
 * route to Illustrator except going back. Four links out of every product page
 * turns 499 dead ends into a network a crawler can walk and a shopper can
 * browse.
 *
 * Same publisher and same shelf first, because "other Adobe design tools" is a
 * useful set and "other things that cost about the same" is not. If that is
 * too narrow — a shelf holding one product — it widens to the publisher rather
 * than returning nothing, since a page with no links out is the thing being
 * fixed.
 */
export async function getRelated(
  product: {
    id: string;
    brand: { slug: string };
    category: { slug: string };
  },
  currency: CurrencyCode,
  anchorMinor: number | null,
  take = 4,
) {
  const shared = {
    ...ON_SALE,
    id: { not: product.id },
    brand: { slug: product.brand.slug },
  };

  const pool = await prisma.product.findMany({
    where: { ...shared, category: { slug: product.category.slug } },
    select: productSelect(currency),
    take: 60,
  });

  let candidates = pool.filter(isListable);

  // Widen to the publisher when the shelf is too thin. A shelf holding one
  // product is common in the smaller ranges, and returning nothing there would
  // leave exactly the pages that most need links with none.
  if (candidates.length < take) {
    const wider = await prisma.product.findMany({
      where: {
        ...shared,
        id: { notIn: [product.id, ...candidates.map((row) => row.id)] },
      },
      select: productSelect(currency),
      take: 60,
    });
    candidates = [...candidates, ...wider.filter(isListable)];
  }

  /*
    Ranked by price, not alphabetically.

    Ordering by name put four "generative credits" packs under Photoshop,
    because that is what sorts first in Adobe's range — which is a useless
    suggestion to a shopper and a useless link to a search engine. What makes
    two listings genuinely related here is that somebody deciding between them
    would compare them, and price is the closest thing this shop holds to that:
    a tool at roughly the price of the one you are reading about is a tool of
    roughly the same kind, while a top-up pack at a fiftieth of it is not.

    A featured listing edges ahead of an unfeatured one at a similar price,
    because those are the ones written for a shop window. With no price to
    anchor to — a quote-only product — featured order is all there is.
  */
  const priced = candidates.map((row) => {
    const sellable = sellableVariants(row.variants);
    const cheapest = sellable.reduce(
      (low, variant) => Math.min(low, priceOf(variant)!.priceMinor),
      Number.POSITIVE_INFINITY,
    );
    return { row, cheapest };
  });

  priced.sort((a, b) => {
    if (a.row.featured !== b.row.featured) return a.row.featured ? -1 : 1;
    if (anchorMinor === null) return a.row.name.localeCompare(b.row.name);
    // Compared as a ratio rather than a difference: being ₹500 away means
    // something different at ₹1,000 and at ₹200,000.
    const distance = (n: number) =>
      Number.isFinite(n) && n > 0
        ? Math.abs(Math.log(n / anchorMinor))
        : Number.POSITIVE_INFINITY;
    return distance(a.cheapest) - distance(b.cheapest);
  });

  return priced.slice(0, take).map((entry) => entry.row);
}

export type BrowseFilters = {
  q?: string;
  category?: string;
  brand?: string;
  term?: string;
  maxPrice?: number;
  minRating?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "rating";
};

/**
 * Browse and search share one query. Matching is a set of case-insensitive
 * contains clauses across the fields a shopper would expect to match. It is
 * honest about being simple: below a few thousand rows it is indistinguishable
 * from something cleverer, and above that it should be replaced with Postgres
 * full-text search rather than tuned.
 */
/** How many listings a shelf shows at once. See `browse` for why. */
export const PER_PAGE = 48;

export type BrowsePage = {
  items: Awaited<ReturnType<typeof getFeatured>>;
  total: number;
  page: number;
  pages: number;
};

/**
 * A shelf, one page at a time.
 *
 * It used to return every match, and the catalogue page rendered all of them:
 * two megabytes of HTML holding 998 links and 499 cards, on the page linked
 * from every header and the one a search engine measures Core Web Vitals on.
 * Compression hid the transfer cost and hid nothing else — a phone still had
 * to parse all of it before the page could be touched.
 *
 * The link count was the quieter half of the same problem. Authority passed
 * from a page is divided among its links, so a page linking to 499 products
 * gave each of them a five-hundredth of it. Forty-eight to a page concentrates
 * that roughly tenfold, and turns one enormous page that ranks for nothing
 * into a series of pages that can each rank for something.
 *
 * The sort happens after the query rather than in it, because "cheapest" means
 * the lowest price across a product's variants in this market, which is not a
 * column. That costs one full read per shelf and is the reason this is not
 * `skip`/`take` — the page slice is taken after sorting, so page two is the
 * next forty-eight of the right order rather than of the database's.
 */
export async function browse(
  filters: BrowseFilters,
  currency: CurrencyCode,
  page = 1,
): Promise<BrowsePage> {
  const terms = (filters.q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const products = await prisma.product.findMany({
    where: {
      ...ON_SALE,
      AND: [
        filters.category ? { category: { slug: filters.category } } : {},
        filters.brand ? { brand: { slug: filters.brand } } : {},
        filters.term
          ? {
              term: filters.term as
                | "ANNUAL_SUBSCRIPTION"
                | "MONTHLY_COMMITMENT"
                | "PERPETUAL",
            }
          : {},
        ...terms.map((term) => ({
          OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            { summary: { contains: term, mode: "insensitive" as const } },
            { brand: { name: { contains: term, mode: "insensitive" as const } } },
            {
              category: {
                name: { contains: term, mode: "insensitive" as const },
              },
            },
            {
              variants: {
                some: { sku: { contains: term, mode: "insensitive" as const } },
              },
            },
            // Somebody who pastes a publisher's part number in expects to land
            // on the listing, not on nothing.
            {
              variants: {
                some: {
                  partNumber: { contains: term, mode: "insensitive" as const },
                },
              },
            },
          ],
        })),
      ],
    },
    select: productSelect(currency),
  });

  const decorated = products
    // A priced product with no price in this market is not shown in it. A
    // quote-only one has no price anywhere and is shown everywhere.
    .filter(isListable)
    .map((product) => {
      // Infinity for a quote-only product, which is deliberate in both places
      // it is read: it sorts to the end of a price sort, and it fails a
      // maximum-price filter, because somebody who typed a ceiling has asked
      // to see things that cost less than it and we cannot say that this does.
      const cheapest = sellableVariants(product.variants).reduce(
        (low, variant) => Math.min(low, priceOf(variant)!.priceMinor),
        Number.POSITIVE_INFINITY,
      );
      const rating =
        product.reviews.length > 0
          ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
            product.reviews.length
          : 0;
      return { product, cheapest, rating };
    })
    .filter((row) => {
      if (filters.maxPrice && row.cheapest > filters.maxPrice) return false;
      if (filters.minRating && row.rating < filters.minRating) return false;
      return true;
    });

  // A quote-only product has no price, so it goes last in either direction —
  // not first in one of them. Sorting descending on Infinity would put the
  // things we cannot price at the top of "most expensive first", which reads
  // as a claim about their price.
  const unpriced = (n: number) => !Number.isFinite(n);

  switch (filters.sort) {
    case "price-asc":
      decorated.sort((a, b) => a.cheapest - b.cheapest);
      break;
    case "price-desc":
      decorated.sort((a, b) => {
        if (unpriced(a.cheapest) !== unpriced(b.cheapest)) {
          return unpriced(a.cheapest) ? 1 : -1;
        }
        return b.cheapest - a.cheapest;
      });
      break;
    case "rating":
      decorated.sort((a, b) => b.rating - a.rating);
      break;
    default:
      decorated.sort((a, b) => b.rating - a.rating || a.cheapest - b.cheapest);
  }

  const total = decorated.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  // A page number past the end shows the last page rather than nothing. A
  // crawler that guesses ?page=99 should find a page, not a blank shelf that
  // looks like a fault.
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * PER_PAGE;

  return {
    items: decorated.slice(start, start + PER_PAGE).map((row) => row.product),
    total,
    page: current,
    pages,
  };
}

export function ratingOf(reviews: { rating: number }[]): {
  average: number;
  count: number;
} {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}

export function specRows(specs: unknown): [string, string][] {
  if (specs === null || typeof specs !== "object" || Array.isArray(specs)) {
    return [];
  }
  return Object.entries(specs as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

/**
 * The specification table as editable text, one "Label: value" per line.
 *
 * Lives here rather than beside the action that parses it back, because a
 * `"use server"` module may export nothing but async functions — a plain
 * helper exported from one is a build error, not a lint warning.
 */
export function specsToText(specs: unknown): string {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return "";
  return Object.entries(specs as Record<string, unknown>)
    .map(([label, value]) => `${label}: ${String(value)}`)
    .join("\n");
}

export const TERM_LABELS: Record<string, string> = {
  ANNUAL_SUBSCRIPTION: "Annual subscription",
  MONTHLY_COMMITMENT: "Monthly, annual commitment",
  PERPETUAL: "Perpetual licence",
};

export const TERM_NOTES: Record<string, string> = {
  ANNUAL_SUBSCRIPTION: "Renews yearly. Nothing renews automatically here.",
  MONTHLY_COMMITMENT: "Billed monthly across a twelve-month term.",
  PERPETUAL: "Bought outright. Yours to keep, with no renewal.",
};

/**
 * What the publisher calls their own number.
 *
 * Each of the three uses a different word for the same thing, and using the
 * wrong one is the kind of small wrongness a procurement officer notices
 * immediately: Adobe prints "Part Number", Microsoft prints ProductId and
 * SkuId. Falling back to the neutral phrase is right for a publisher whose
 * price list we do not hold — and those carry no number at all, so the label
 * is never shown for them anyway.
 */
export function partNumberLabel(brandSlug: string): string {
  switch (brandSlug) {
    case "adobe":
      return "Adobe part number";
    case "microsoft":
      return "Microsoft product ID";
    default:
      return "Publisher part number";
  }
}
