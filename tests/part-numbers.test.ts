import { describe, expect, it } from "vitest";

import { ADOBE_PRODUCTS } from "../prisma/adobe";
import { MICROSOFT_PRODUCTS } from "../prisma/microsoft";
import adobePriceList from "../prisma/data/adobe-price-list.json";
import microsoftPriceList from "../prisma/data/microsoft-price-list.json";
import { browse, partNumberLabel } from "@/lib/catalogue";
import { prisma } from "@/lib/db";

/**
 * The publisher's own number for the thing being sold.
 *
 * This is not decoration. A business buyer raises a purchase order against a
 * part number, their finance team matches the invoice on it, and a buyer
 * comparing two resellers is checking that both are quoting the same item —
 * which they cannot do against our own prefixed SKU, because that is ours.
 *
 * So the rule is that it is copied, never composed from something we made up:
 * every value here must appear in the price list the listing came from.
 */
describe("Adobe part numbers", () => {
  const listed = new Set(adobePriceList.map((row) => row.partNumber));

  it("are on every variant", () => {
    for (const product of ADOBE_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.partNumber, variant.sku).toBeTruthy();
      }
    }
  });

  it("are the price list's Part Number column, verbatim", () => {
    for (const product of ADOBE_PRODUCTS) {
      for (const variant of product.variants) {
        expect(listed, variant.sku).toContain(variant.partNumber);
      }
    }
  });

  it("are not our SKU wearing a different name", () => {
    // ADBE- is our prefix. A part number carrying it would mean somebody had
    // derived the publisher's number from ours instead of reading it off the
    // price list.
    for (const product of ADOBE_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.partNumber).not.toMatch(/^ADBE-/);
        expect(variant.sku).toBe(`ADBE-${variant.partNumber}`);
      }
    }
  });
});

describe("Microsoft product IDs", () => {
  const listed = new Set(
    microsoftPriceList.map((row) => `${row.productId}:${row.skuId}`),
  );

  it("are on every variant", () => {
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.partNumber, variant.sku).toBeTruthy();
      }
    }
  });

  it("join the price list's two columns the way Microsoft writes them", () => {
    // The sheet carries ProductId and SkuId separately; a partner quotes them
    // as one colon-joined identity. Both halves stay verbatim.
    for (const product of MICROSOFT_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.partNumber, variant.sku).toMatch(/^[A-Z0-9]+:[0-9A-Za-z]+$/);
        expect(listed, variant.sku).toContain(variant.partNumber);
      }
    }
  });
});

describe("naming the number", () => {
  it("uses each publisher's own word for it", () => {
    // Calling Adobe's part number a "product ID" is the sort of small
    // wrongness a procurement officer notices immediately.
    expect(partNumberLabel("adobe")).toBe("Adobe part number");
    expect(partNumberLabel("microsoft")).toBe("Microsoft product ID");
  });

  it("falls back to something neutral for a publisher we have no list for", () => {
    expect(partNumberLabel("autodesk")).toBe("Publisher part number");
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("part numbers in the shop", () => {
  it("are on every variant we hold a price list for", async () => {
    const missing = await prisma.variant.count({
      where: {
        partNumber: null,
        product: { brand: { slug: { in: ["microsoft", "adobe"] } } },
      },
    });
    expect(missing).toBe(0);
  });

  it("are absent where there is no price list to copy one from", async () => {
    // Inventing a part number would be the same mistake as inventing a price:
    // a plausible string that no publisher would recognise.
    const invented = await prisma.variant.count({
      where: { partNumber: { not: null }, product: { quoteOnly: true } },
    });
    expect(invented).toBe(0);
  });

  it("find the listing when somebody pastes one into the search box", async () => {
    const variant = await prisma.variant.findFirstOrThrow({
      where: { partNumber: { not: null }, product: { published: true } },
      select: { partNumber: true, product: { select: { slug: true } } },
    });

    const found = await browse({ q: variant.partNumber! }, "INR");
    expect(found.map((p) => p.slug)).toContain(variant.product.slug);
  });
});
