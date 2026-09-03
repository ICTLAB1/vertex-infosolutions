import { describe, expect, it } from "vitest";

import { ADOBE_PRODUCTS } from "../prisma/adobe";
import priceList from "../prisma/data/adobe-price-list.json";
import { INR_PER_USD } from "../prisma/pricing";

describe("the Adobe price book", () => {
  it("carries no trace of what we pay for a licence", () => {
    // The workbook has a `DTP per Year /Per TXn` column beside the street
    // price. If the extractor ever starts copying it, this fails before the
    // repository publishes the buy price.
    const keys = new Set(priceList.flatMap((row) => Object.keys(row)));
    expect([...keys].sort()).toEqual([
      "family",
      "listExGstMinor",
      "partNumber",
      "productType",
    ]);
  });

  it("adds GST to the Indian shelf price", () => {
    const photoshop = ADOBE_PRODUCTS.find(
      (p) => p.name === "Adobe Photoshop for teams",
    );
    expect(photoshop).toBeDefined();
    // Adobe's published India street price is 41,676.42 per seat per year,
    // exclusive of tax.
    expect(photoshop!.variants[0].inr).toEqual([49178, 49178]);
  });

  it("sets the export price at the same level as the domestic one", () => {
    const photoshop = ADOBE_PRODUCTS.find(
      (p) => p.name === "Adobe Photoshop for teams",
    )!;
    // Converted from the tax-inclusive rupee figure by instruction, so the
    // price abroad matches the price at home. The 18% is price, not tax: the
    // export invoice still shows no tax line, because the supply is zero-rated.
    expect(photoshop.variants[0].usd[1]).toBe(
      Math.round((41676.42 * 1.18) / INR_PER_USD),
    );
  });

  it("says on every listing that the price is the single-seat band", () => {
    // Adobe's 10-49 and 50-99 bands are cheaper and real. Until the cart can
    // charge them, a buyer of twenty seats has to be told to ask rather than
    // quietly overpay.
    for (const product of ADOBE_PRODUCTS) {
      expect(product.bullets.join(" ")).toMatch(/1[–-]9 seat band/);
      expect(product.specs["Volume band"]).toMatch(/Level 1/);
    }
  });

  it("points every logo at a file the repository holds", async () => {
    const { existsSync } = await import("node:fs");
    for (const product of ADOBE_PRODUCTS) {
      if (!product.logo) continue;
      expect(existsSync(`public${product.logo}`)).toBe(true);
    }
  });

  it("gives every product a distinct slug and every variant a distinct SKU", () => {
    const slugs = ADOBE_PRODUCTS.map((p) => p.slug);
    const skus = ADOBE_PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(skus).size).toBe(skus.length);
  });
});
