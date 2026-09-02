import "server-only";

import { prisma } from "@/lib/db";

/** The shape every product card and detail page reads from. */
export const productSelect = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  summary: true,
  bullets: true,
  specs: true,
  hsnSac: true,
  origin: true,
  glyph: true,
  featured: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  variants: {
    select: {
      id: true,
      sku: true,
      name: true,
      mrpMinor: true,
      priceMinor: true,
      gstRatePercent: true,
      stockOnHand: true,
      leadDays: true,
    },
    orderBy: { priceMinor: "asc" },
  },
  reviews: { select: { rating: true } },
} as const;

export type CatalogueProduct = Awaited<ReturnType<typeof getProduct>>;

/** A product as it appears in a grid — the shape `productSelect` returns. */
export type ListedProduct = Awaited<ReturnType<typeof getFeatured>>[number];

export async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    select: {
      ...productSelect,
      reviews: {
        select: {
          id: true,
          author: true,
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

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { position: "asc" } });
}

export async function getFeatured() {
  return prisma.product.findMany({
    where: { featured: true },
    select: productSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getByCategory(slug: string, take = 8) {
  return prisma.product.findMany({
    where: { category: { slug } },
    select: productSelect,
    take,
    orderBy: { createdAt: "asc" },
  });
}

export type BrowseFilters = {
  q?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  sort?: "relevance" | "price-asc" | "price-desc" | "rating";
};

/**
 * Browse and search share one query. SQLite has no full-text index here, so a
 * search is a set of LIKE clauses across the fields a shopper would expect to
 * match — name, summary, brand and SKU. It is honest about being simple: at
 * catalogue sizes below a few thousand rows it is indistinguishable from
 * something cleverer, and above that it should be replaced rather than tuned.
 */
export async function browse(filters: BrowseFilters) {
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
        ...terms.map((term) => ({
          OR: [
            { name: { contains: term } },
            { summary: { contains: term } },
            { brand: { name: { contains: term } } },
            { category: { name: { contains: term } } },
            { variants: { some: { sku: { contains: term } } } },
          ],
        })),
      ],
    },
    select: productSelect,
  });

  // Price, rating and stock depend on the variants and reviews already loaded,
  // so they are applied here rather than as another round trip.
  const decorated = products
    .map((product) => {
      const cheapest = product.variants.reduce(
        (low, variant) => Math.min(low, variant.priceMinor),
        Number.POSITIVE_INFINITY,
      );
      const rating =
        product.reviews.length > 0
          ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
            product.reviews.length
          : 0;
      const inStock = product.variants.some(
        (variant) => variant.stockOnHand === null || variant.stockOnHand > 0,
      );
      return { product, cheapest, rating, inStock };
    })
    .filter((row) => {
      if (filters.maxPrice && row.cheapest > filters.maxPrice) return false;
      if (filters.minRating && row.rating < filters.minRating) return false;
      if (filters.inStockOnly && !row.inStock) return false;
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
      // Relevance: in-stock first, then better rated. A shopper is rarely
      // helped by a top result they cannot buy.
      decorated.sort(
        (a, b) => Number(b.inStock) - Number(a.inStock) || b.rating - a.rating,
      );
  }

  return decorated.map((row) => row.product);
}

export async function getBrands() {
  return prisma.brand.findMany({
    where: { products: { some: {} } },
    orderBy: { name: "asc" },
  });
}

/** Average rating and count, from reviews already loaded onto a product. */
export function ratingOf(reviews: { rating: number }[]): {
  average: number;
  count: number;
} {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}

export function parseBullets(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function parseSpecs(json: string): [string, string][] {
  try {
    const value: unknown = JSON.parse(json);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
    return Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
  } catch {
    return [];
  }
}
