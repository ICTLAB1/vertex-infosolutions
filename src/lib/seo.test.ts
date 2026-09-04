import { describe, expect, it } from "vitest";

import { priceValidUntil, productImages } from "@/lib/seo";
import { specsToText } from "@/lib/catalogue";

/**
 * The picture a listing gives a search engine.
 *
 * Worth a test rather than a glance, because the failure is invisible: a
 * listing with no image renders perfectly and is silently ineligible for a
 * product rich result. Nothing on the page says so and nothing in the log
 * does either.
 */
describe("productImages", () => {
  const microsoft = { logo: "/logos/microsoft/microsoft.svg", brand: { slug: "microsoft" } };

  it("never returns an empty list", () => {
    for (const brand of ["microsoft", "adobe", "autodesk", "somebody-else"]) {
      const images = productImages({ logo: null, brand: { slug: brand } });
      expect(images.all.length).toBeGreaterThan(0);
      expect(images.primary).toMatch(/^https?:\/\//);
      expect(images.social).toMatch(/^https?:\/\//);
    }
  });

  it("skips a vector icon, which no social platform renders", () => {
    expect(productImages(microsoft).all.some((url) => url.endsWith(".svg"))).toBe(false);
  });

  it("prefers the listing's own picture when it is a raster", () => {
    const images = productImages({
      logo: "/logos/adobe/creative-cloud.png",
      brand: { slug: "adobe" },
    });
    expect(images.primary).toContain("/logos/adobe/creative-cloud.png");
  });

  it("gives social the wide card, not the square one", () => {
    expect(productImages(microsoft).social).toContain("16x9");
  });

  it("falls back to the shop's own logo for an unknown publisher", () => {
    const images = productImages({ logo: null, brand: { slug: "nobody" } });
    expect(images.all).toHaveLength(1);
    expect(images.primary).toContain("/brand/");
  });

  it("returns absolute URLs, because a search engine is given no base", () => {
    for (const url of productImages(microsoft).all) {
      expect(() => new URL(url)).not.toThrow();
    }
  });
});

describe("priceValidUntil", () => {
  it("is the end of the year the request is made in", () => {
    expect(priceValidUntil(new Date("2026-09-04T00:00:00Z"))).toBe("2026-12-31");
    expect(priceValidUntil(new Date("2027-01-01T00:00:00Z"))).toBe("2027-12-31");
  });
});

describe("specsToText", () => {
  it("writes one row per line, in the order they are stored", () => {
    expect(specsToText({ Term: "12 months", Delivery: "Electronic" })).toBe(
      "Term: 12 months\nDelivery: Electronic",
    );
  });

  it("survives whatever is actually in the column", () => {
    expect(specsToText(null)).toBe("");
    expect(specsToText([])).toBe("");
    expect(specsToText("a string")).toBe("");
  });
});
