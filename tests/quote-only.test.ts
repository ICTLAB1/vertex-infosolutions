import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { browse, isListable } from "@/lib/catalogue";
import { prisma } from "@/lib/db";

/**
 * A licence we sell without publishing a price.
 *
 * The alternative to this flag was the thing it replaced: eleven Autodesk
 * listings carrying figures that came from nowhere. A wrong price on a
 * storefront is not a display bug — somebody buys at it, and the shop is held
 * to it — so the rule here is stronger than "show a placeholder". A quote-only
 * product holds no price row in any currency, which means there is no number
 * in the database for a page, an invoice or a checkout to pick up by accident.
 */
describe("what belongs on the shelf", () => {
  const priced = { quoteOnly: false, variants: [{ prices: [{}] }] };
  const unpricedHere = { quoteOnly: false, variants: [{ prices: [] }] };
  const quoteOnly = { quoteOnly: true, variants: [{ prices: [] }] };

  it("keeps a product priced in this market", () => {
    expect(isListable(priced)).toBe(true);
  });

  it("hides a priced product that is not sold in this market", () => {
    // Two absences look identical in the data and mean opposite things. This
    // one is a product whose price book covers rupees and not dollars.
    expect(isListable(unpricedHere)).toBe(false);
  });

  it("keeps a quote-only product, which has no price anywhere by design", () => {
    // Hiding this one would take a whole publisher off the shelf.
    expect(isListable(quoteOnly)).toBe(true);
  });
});

describe("the Autodesk range in the seed", () => {
  const source = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");

  it("carries no price figures at all", () => {
    // Read from the source rather than the database, because the mistake being
    // guarded against is somebody typing a plausible-looking number back in.
    // A test that reads the seeded rows would pass for as long as nobody had
    // re-run the seed.
    const autodeskVariants = source
      .split("\n")
      .filter((line) => line.includes('sku: "ADSK-'));

    expect(autodeskVariants.length).toBeGreaterThan(10);
    for (const line of autodeskVariants) {
      expect(line, line.trim()).not.toMatch(/usd:|inr:/);
    }
  });

  it("marks every one of them quote-only", () => {
    const slugs = source.match(/slug: "autodesk-[a-z0-9-]+"/g) ?? [];
    expect(slugs.length).toBeGreaterThan(10);
    // Each Autodesk product's block must set the flag before its variants.
    for (const slug of slugs) {
      const start = source.indexOf(slug);
      const variants = source.indexOf("variants: [", start);
      expect(
        source.slice(start, variants),
        `${slug} is not marked quoteOnly`,
      ).toContain("quoteOnly: true");
    }
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("quote-only products in the shop", () => {
  it("hold no price row in any currency", async () => {
    const withPrices = await prisma.product.count({
      where: { quoteOnly: true, variants: { some: { prices: { some: {} } } } },
    });
    expect(withPrices).toBe(0);

    // And the flag is actually in use, so this is not passing on an empty set.
    expect(await prisma.product.count({ where: { quoteOnly: true } })).toBeGreaterThan(0);
  });

  it("still appear when somebody browses the publisher", async () => {
    const listed = await browse({ brand: "autodesk" }, "USD");
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((product) => product.quoteOnly)).toBe(true);
  });

  it("sort last whichever way the price sort points", async () => {
    // Descending is the one that catches a naive implementation: an unpriced
    // product treated as infinitely expensive tops "most expensive first",
    // which reads as a claim about its price.
    for (const sort of ["price-asc", "price-desc"] as const) {
      const listed = await browse({ sort }, "USD");
      const firstUnpriced = listed.findIndex((p) => p.quoteOnly);
      const lastPriced = listed.map((p) => p.quoteOnly).lastIndexOf(false);
      expect(firstUnpriced, sort).toBeGreaterThan(lastPriced);
    }
  });

  it("drop out when the shopper sets a price ceiling", async () => {
    // A maximum price is an explicit statement about price. We cannot say this
    // product costs less than the ceiling, so we do not imply it.
    const listed = await browse({ brand: "autodesk", maxPrice: 100_000_00 }, "USD");
    expect(listed).toHaveLength(0);
  });
});
