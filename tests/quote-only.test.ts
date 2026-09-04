import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

/**
 * Built here rather than read from the seeded catalogue.
 *
 * CI migrates its database and never seeds it, so a test that asked the
 * catalogue for a quote-only product found none and failed — on the deploy
 * gate, after the merge, which is the worst place to learn it. Owning the rows
 * it asserts on also means this says something on any database, not only one
 * that happens to have Autodesk in it.
 */
describe.skipIf(!hasDatabase)("quote-only products in the shop", () => {
  const stamp = Date.now();
  const brand = `qo-brand-${stamp}`;
  const pricedSlug = `qo-priced-${stamp}`;
  const quotedSlug = `qo-quoted-${stamp}`;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { slug: `qo-cat-${stamp}`, name: "Quote-only test" },
    });
    const brandRow = await prisma.brand.create({
      data: { slug: brand, name: `Quote-only test ${stamp}` },
    });
    const shared = { brandId: brandRow.id, categoryId: category.id };

    await prisma.product.create({
      data: {
        ...shared,
        slug: pricedSlug,
        name: "Priced licence",
        summary: "Has a price in both markets.",
        variants: {
          create: {
            sku: `QO-PRICED-${stamp}`,
            name: "1 user, 1 year",
            prices: {
              create: [
                { currency: "USD", listMinor: 1_000_00, priceMinor: 1_000_00 },
                { currency: "INR", listMinor: 88_000_00, priceMinor: 88_000_00 },
              ],
            },
          },
        },
      },
    });

    await prisma.product.create({
      data: {
        ...shared,
        slug: quotedSlug,
        name: "Quoted licence",
        summary: "Sold, but not at a published price.",
        quoteOnly: true,
        // Deliberately no `prices`. That absence is the whole subject.
        variants: { create: { sku: `QO-QUOTED-${stamp}`, name: "1 user, 1 year" } },
      },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { slug: { in: [pricedSlug, quotedSlug] } },
    });
    await prisma.brand.deleteMany({ where: { slug: brand } });
    await prisma.category.deleteMany({ where: { slug: `qo-cat-${stamp}` } });
  });

  it("hold no price row in any currency", async () => {
    const withPrices = await prisma.product.count({
      where: { quoteOnly: true, variants: { some: { prices: { some: {} } } } },
    });
    expect(withPrices).toBe(0);
  });

  it("still appear when somebody browses the publisher", async () => {
    // A priced product with no row in this currency would be hidden. This one
    // has no row in any currency and must not be.
    const listed = await browse({ brand }, "USD");
    expect(listed.map((product) => product.slug)).toContain(quotedSlug);
  });

  it("sort last whichever way the price sort points", async () => {
    // Descending is the one that catches a naive implementation: an unpriced
    // product treated as infinitely expensive tops "most expensive first",
    // which reads as a claim about its price.
    for (const sort of ["price-asc", "price-desc"] as const) {
      const listed = await browse({ brand, sort }, "USD");
      expect(listed.map((product) => product.slug), sort).toEqual([
        pricedSlug,
        quotedSlug,
      ]);
    }
  });

  it("drop out when the shopper sets a price ceiling", async () => {
    // A maximum price is an explicit statement about price. We cannot say this
    // product costs less than the ceiling, so we do not imply it.
    const listed = await browse({ brand, maxPrice: 100_000_00 }, "USD");
    expect(listed.map((product) => product.slug)).toEqual([pricedSlug]);
  });
});
