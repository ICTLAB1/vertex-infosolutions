import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { absolute } from "@/lib/seo";

/**
 * Pages that exist regardless of the catalogue.
 *
 * The two that earn a daily crawl are the ones whose content actually moves:
 * the home page and the catalogue. A policy page changes when a lawyer reads
 * it, which is not weekly, and telling a crawler otherwise only teaches it to
 * ignore the hint.
 */
const STATIC_PAGES: [path: string, priority: number, changeFrequency: "daily" | "monthly"][] = [
  ["/", 1, "daily"],
  ["/s", 0.9, "daily"],
  ["/licensing", 0.5, "monthly"],
  ["/delivery", 0.5, "monthly"],
  ["/contact", 0.5, "monthly"],
  ["/returns", 0.5, "monthly"],
  ["/terms", 0.5, "monthly"],
  ["/website-terms", 0.5, "monthly"],
  ["/privacy", 0.5, "monthly"],
  ["/cookies", 0.5, "monthly"],
  ["/export-compliance", 0.5, "monthly"],
];

/**
 * Read at request time, not at build time.
 *
 * Two reasons, and either alone would be enough. A sitemap frozen at build
 * time starts lying the moment somebody withdraws a listing in the back
 * office: it goes on pointing a crawler at a page that now 404s, which is
 * exactly the signal of neglect the `published` filter below exists to avoid.
 * And prerendering it means the build needs a database — so `npm run build`
 * with none, which is how the image is built and what CI checks, fails on this
 * one route while every other page in the shop is dynamic already.
 *
 * The cost is a query per crawler fetch of one URL. That is nothing.
 *
 * One sitemap is enough at this size. The protocol's ceiling is 50,000 URLs
 * and this returns a few hundred; if the catalogue ever approaches that,
 * `generateSitemaps` splits it into an index without changing anything here.
 */
export const dynamic = "force-dynamic";

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
    ...STATIC_PAGES.map(([path, priority, changeFrequency]) => ({
      url: absolute(path),
      lastModified: now,
      changeFrequency,
      priority,
    })),
    // A brand page is where somebody searching "Adobe reseller India" lands,
    // so it outranks a category page, which answers a narrower question.
    ...brands.map((brand) => ({
      url: absolute(`/s?brand=${brand.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
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
