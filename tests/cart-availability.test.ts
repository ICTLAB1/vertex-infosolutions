import { describe, expect, it } from "vitest";

import { totalsFor, type CartLine } from "@/lib/cart";
import type { Market } from "@/lib/market";

/**
 * A basket outlives the listing in it.
 *
 * Somebody adds a licence, and before they pay an administrator withdraws it —
 * usually because its price turned out to be wrong, which is exactly the case
 * where charging the old price is worst. The basket has to notice. Until it
 * did, a cart built before a withdrawal went through checkout as though
 * nothing had happened.
 */
function line(
  overrides: {
    published?: boolean;
    quoteOnly?: boolean;
    priceMinor?: number | null;
    qty?: number;
  } = {},
): CartLine {
  const {
    published = true,
    quoteOnly = false,
    priceMinor = 10_000,
    qty = 1,
  } = overrides;

  return {
    id: `line-${Math.random()}`,
    qty,
    variant: {
      seats: 1,
      sku: "TEST-1",
      name: "1 user, 1 year",
      prices:
        priceMinor === null
          ? []
          : [{ currency: "INR", listMinor: priceMinor, priceMinor }],
      product: {
        slug: "test",
        name: "Test licence",
        glyph: "licence",
        gstRatePercent: 18,
        term: "ANNUAL_SUBSCRIPTION",
        cspNewTenant: false,
        published,
        quoteOnly,
        brand: { name: "Test" },
      },
    },
    // The rest of the row is not read by `totalsFor`.
  } as unknown as CartLine;
}

const india: Market = {
  currency: "INR",
  country: "IN",
  domestic: true,
  source: "test",
} as unknown as Market;

describe("what a basket is willing to total", () => {
  it("totals an ordinary line", () => {
    const totals = totalsFor([line({ qty: 2 })], india);
    expect(totals.totalMinor).toBe(20_000);
    expect(totals.count).toBe(2);
    expect(totals.unavailable).toBe(0);
  });

  it("excludes a product that has been withdrawn, and blocks checkout", () => {
    const totals = totalsFor([line(), line({ published: false })], india);
    // The withdrawn line contributes nothing to the money…
    expect(totals.totalMinor).toBe(10_000);
    expect(totals.count).toBe(1);
    // …and its presence is what stops the order being placed.
    expect(totals.withdrawn).toBe(1);
    expect(totals.unavailable).toBe(1);
  });

  it("excludes a withdrawn product even when it still has a price row", () => {
    // Withdrawing does not delete prices — the listing keeps its history — so
    // a check that only looked for a missing price would sail straight past
    // this and charge for something taken off sale.
    const totals = totalsFor([line({ published: false, priceMinor: 50_000 })], india);
    expect(totals.totalMinor).toBe(0);
    expect(totals.withdrawn).toBe(1);
  });

  it("excludes a quote-only product, which has no published price", () => {
    const totals = totalsFor([line({ quoteOnly: true, priceMinor: null })], india);
    expect(totals.totalMinor).toBe(0);
    expect(totals.withdrawn).toBe(1);
    expect(totals.unavailable).toBe(1);
  });

  it("keeps the two reasons apart, and counts both as blocking", () => {
    const totals = totalsFor(
      [line(), line({ published: false }), line({ priceMinor: null })],
      india,
    );
    expect(totals.withdrawn).toBe(1);
    expect(totals.unpriced).toBe(1);
    expect(totals.unavailable).toBe(2);
    expect(totals.totalMinor).toBe(10_000);
  });

  it("charges GST only on the lines that survive", () => {
    const totals = totalsFor([line({ priceMinor: 11_800 }), line({ published: false })], india);
    expect(totals.totalMinor).toBe(11_800);
    expect(totals.netMinor).toBe(10_000);
    expect(totals.taxMinor).toBe(1_800);
  });
});
