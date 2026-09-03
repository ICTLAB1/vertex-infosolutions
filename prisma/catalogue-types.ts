/**
 * The shape the seed writes.
 *
 * Shared because the catalogue now comes from two places: the sample products
 * for publishers whose price book we do not hold yet, written by hand in
 * `seed.ts`, and the Microsoft range in `microsoft.ts`, generated from the
 * distributor price list.
 */

export type Term = "ANNUAL_SUBSCRIPTION" | "MONTHLY_COMMITMENT" | "PERPETUAL";

export type SeedReview = {
  author: string;
  country?: string;
  rating: number;
  title: string;
  body: string;
  verified?: boolean;
};

export type SeedVariant = {
  sku: string;
  name: string;
  seats: number;
  /** [list, price] in whole dollars. */
  usd: [number, number];
  /** [list, price] in whole rupees, GST-inclusive. */
  inr: [number, number];
};

export type SeedProduct = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  term: Term;
  summary: string;
  bullets: string[];
  specs: Record<string, string>;
  featured?: boolean;
  /** Path under `public/` to the publisher's own icon, when we hold one. */
  logo?: string;
  /** Delivered into a newly created Microsoft tenant. See the schema. */
  cspNewTenant?: boolean;
  variants: SeedVariant[];
  reviews?: SeedReview[];
};
