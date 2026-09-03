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
    featured: true,
    brand: { select: { name: true, slug: true } },
    category: { select: { name: true, slug: true } },
    variants: {
      select: {
        id: true,
        sku: true,
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

export async function getProduct(slug: string, currency: CurrencyCode) {
  return prisma.product.findUnique({
    where: { slug },
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
}

export type CatalogueProduct = Awaited<ReturnType<typeof getProduct>>;

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { position: "asc" } });
}

export async function getBrands() {
  return prisma.brand.findMany({
    where: { products: { some: {} } },
    orderBy: { name: "asc" },
  });
}

export async function getFeatured(currency: CurrencyCode) {
  return prisma.product.findMany({
    where: { featured: true },
    select: productSelect(currency),
    orderBy: { createdAt: "asc" },
  });
}

export async function getByBrand(slug: string, currency: CurrencyCode, take = 8) {
  return prisma.product.findMany({
    where: { brand: { slug } },
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
    where: { category: { slug } },
    select: productSelect(currency),
    take,
    orderBy: { createdAt: "asc" },
  });
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
export async function browse(filters: BrowseFilters, currency: CurrencyCode) {
  const terms = (filters.q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const products = await prisma.product.findMany({
    where: {
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
          ],
        })),
      ],
    },
    select: productSelect(currency),
  });

  const decorated = products
    // A product with no price in this market is not shown in it at all.
    .filter((product) => sellableVariants(product.variants).length > 0)
    .map((product) => {
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

  switch (filters.sort) {
    case "price-asc":
      decorated.sort((a, b) => a.cheapest - b.cheapest);
      break;
    case "price-desc":
      decorated.sort((a, b) => b.cheapest - a.cheapest);
      break;
    case "rating":
      decorated.sort((a, b) => b.rating - a.rating);
      break;
    default:
      decorated.sort((a, b) => b.rating - a.rating || a.cheapest - b.cheapest);
  }

  return decorated.map((row) => row.product);
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
