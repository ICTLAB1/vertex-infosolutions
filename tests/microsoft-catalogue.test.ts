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
    expect(premium!.variants[0].inr).toEqual([25913, 25913]);
  });

  it("prices an export from the figure before GST", () => {
    const premium = MICROSOFT_PRODUCTS.find(
      (p) => p.name === "Microsoft 365 Business Premium",
    )!;
    // 21,960 before GST, not 25,913 after it — an export carries no Indian tax,
    // so converting the tax-inclusive figure would export the GST too.
    expect(premium.variants[0].usd[1]).toBe(Math.round(21960 / INR_PER_USD));
  });

  it("never strikes through a price that was never charged", () => {
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.inr[0]).toBe(variant.inr[1]);
        expect(variant.usd[0]).toBe(variant.usd[1]);
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
        expect(variant.inr[1] * 100).toBeLessThanOrEqual(MAX_MINOR);
        expect(variant.usd[1] * 100).toBeLessThanOrEqual(MAX_MINOR);
      }
    }
    // And says which, rather than quietly shrinking the catalogue.
    expect(MICROSOFT_TOO_LARGE.length).toBeGreaterThan(0);
    expect(MICROSOFT_PRODUCTS.length + MICROSOFT_TOO_LARGE.length).toBe(
      priceList.length,
    );
  });

  it("charges at least a dollar for the cheapest add-on", () => {
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.usd[1]).toBeGreaterThan(0);
        expect(variant.inr[1]).toBeGreaterThan(0);
      }
    }
  });
});
