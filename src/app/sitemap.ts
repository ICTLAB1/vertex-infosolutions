import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { absolute } from "@/lib/seo";

/** Pages that exist regardless of the catalogue, with how much they matter. */
const STATIC_PAGES: [path: string, priority: number][] = [
  ["/", 1],
  ["/s", 0.8],
  ["/contact", 0.6],
  ["/licensing", 0.6],
  ["/delivery", 0.5],
  ["/returns", 0.5],
  ["/terms", 0.4],
  ["/privacy", 0.4],
  ["/cookies", 0.3],
  ["/website-terms", 0.3],
  ["/export-compliance", 0.3],
];

/**
 * Every page worth indexing.
 *
 * Products carry their own `updatedAt`, so a crawler re-reads a listing whose
 * price changed rather than the whole catalogue. Brand and category pages are
 * included because they are how somebody searching for "Adobe reseller India"
 * arrives — the product pages answer a narrower question than that.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, brands, categories] = await Promise.all([
    prisma.product.findMany({
      // A withdrawn listing 404s, and a sitemap that points at a 404 is a
      // signal of neglect rather than a helpful hint.
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: "asc" },
    }),
    prisma.brand.findMany({ select: { slug: true } }),
    prisma.category.findMany({ select: { slug: true } }),
  ]);

  const now = new Date();

  return [
    ...STATIC_PAGES.map(([path, priority]) => ({
      url: absolute(path),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority,
    })),
    ...brands.map((brand) => ({
      url: absolute(`/s?brand=${brand.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...categories.map((category) => ({
      url: absolute(`/s?category=${category.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: absolute(`/product/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
