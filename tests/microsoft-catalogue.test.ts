import { describe, expect, it } from "vitest";

import { MAX_MINOR } from "@/lib/money";

import priceList from "../prisma/data/microsoft-price-list.json";
import { INR_PER_USD, MICROSOFT_PRODUCTS, MICROSOFT_TOO_LARGE } from "../prisma/microsoft";

/**
 * The price list is the shop's only source of real prices, so the arithmetic
 * between it and the shelf is worth pinning down. A silent 18% error here is an
 * 18% error on every Indian invoice.
 */
describe("the Microsoft price book", () => {
  it("carries no trace of what we pay for a licence", () => {
    // The workbook has a `Unit Sell Price` column beside the list price. If the
    // extractor ever starts copying it, this fails before the repository
    // publishes the buy price.
    const keys = new Set(priceList.flatMap((row) => Object.keys(row)));
    expect([...keys].sort()).toEqual([
      "billing",
      "listExGstMinor",
      "productId",
      "skuId",
      "tags",
      "title",
    ]);
    for (const row of priceList) {
      expect(row.listExGstMinor).toBeGreaterThan(0);
    }
  });

  it("adds GST to the Indian shelf price", () => {
    const premium = MICROSOFT_PRODUCTS.find(
      (p) => p.name === "Microsoft 365 Business Premium",
    );
    expect(premium).toBeDefined();
    // Microsoft's published India list price is INR 21,960 per user per year,
    // exclusive of tax. The shelf shows it with 18% GST included.
    expect(premium!.variants[0]!.inr).toEqual([25913, 25913]);
  });

  it("sets the export price at the same level as the domestic one", () => {
    const premium = MICROSOFT_PRODUCTS.find(
      (p) => p.name === "Microsoft 365 Business Premium",
    )!;
    // Converted from the tax-inclusive figure by instruction, so the price
    // abroad matches the price at home. The 18% is price, not tax: an export
    // is zero-rated and the invoice shows no tax line.
    expect(premium.variants[0]!.usd![1]).toBe(
      Math.round((21960 * 1.18) / INR_PER_USD),
    );
  });

  it("never strikes through a price that was never charged", () => {
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        // Prices are optional in the seed type, because a quote-only range
        // carries none. This one is not quote-only: every Microsoft SKU comes
        // from the price book and must have both figures.
        expect(variant.inr, variant.sku).toBeDefined();
        expect(variant.usd, variant.sku).toBeDefined();
        expect(variant.inr![0]).toBe(variant.inr![1]);
        expect(variant.usd![0]).toBe(variant.usd![1]);
      }
    }
  });

  it("gives every product a distinct slug and every variant a distinct SKU", () => {
    const slugs = MICROSOFT_PRODUCTS.map((p) => p.slug);
    const skus = MICROSOFT_PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(skus).size).toBe(skus.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("drops the SKUs whose price the order tables cannot hold", () => {
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.inr![1] * 100).toBeLessThanOrEqual(MAX_MINOR);
        expect(variant.usd![1] * 100).toBeLessThanOrEqual(MAX_MINOR);
      }
    }
    // And says which, rather than quietly shrinking the catalogue.
    expect(MICROSOFT_TOO_LARGE.length).toBeGreaterThan(0);
    expect(MICROSOFT_PRODUCTS.length + MICROSOFT_TOO_LARGE.length).toBe(
      priceList.length,
    );
  });

  it("marks every CSP licence as arriving in a new tenant", () => {
    // A buyer who assumes these seats join their existing Microsoft 365 has
    // bought the wrong thing, so the flag that drives that warning is set on
    // every one of them rather than on the ones somebody remembered.
    for (const product of MICROSOFT_PRODUCTS) {
      expect(product.cspNewTenant).toBe(true);
      expect(product.specs["Microsoft tenant"]).toMatch(/new tenant/i);
    }
  });

  it("charges at least a dollar for the cheapest add-on", () => {
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.usd![1]).toBeGreaterThan(0);
        expect(variant.inr![1]).toBeGreaterThan(0);
      }
    }
  });
});
