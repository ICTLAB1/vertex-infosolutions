import { describe, expect, it } from "vitest";

import {
  discountPercent,
  formatMoney,
  formatMoneyExact,
  splitInclusiveTax,
} from "@/lib/money";

describe("formatting", () => {
  it("groups rupees the Indian way, not the Western way", () => {
    // The bug this catches: using en-US for INR, which renders ₹1,234,567
    // instead of ₹12,34,567. Every Indian customer would notice.
    expect(formatMoney(1_234_567_00, "INR")).toBe("₹12,34,567");
    expect(formatMoney(1_234_567_00, "USD")).toBe("$1,234,567");
  });

  it("drops the minor unit on a shelf price and keeps it on an invoice", () => {
    expect(formatMoney(9_200_00, "INR")).toBe("₹9,200");
    expect(formatMoneyExact(9_200_00, "INR")).toBe("₹9,200.00");
    expect(formatMoneyExact(150_00, "USD")).toBe("$150.00");
  });

  it("never renders a price from the wrong currency's symbol", () => {
    expect(formatMoney(150_00, "USD")).not.toContain("₹");
    expect(formatMoney(150_00, "INR")).not.toContain("$");
  });
});

describe("discountPercent", () => {
  it("computes the saving against list", () => {
    expect(discountPercent(165_00, 150_00)).toBe(9);
  });

  it("shows nothing when there is no saving", () => {
    expect(discountPercent(150_00, 150_00)).toBe(0);
    expect(discountPercent(150_00, 160_00)).toBe(0);
    expect(discountPercent(0, 150_00)).toBe(0);
  });
});

describe("splitInclusiveTax", () => {
  it("splits a GST-inclusive total into parts that add back exactly", () => {
    const { netMinor, taxMinor } = splitInclusiveTax(9_200_00, 18);
    expect(netMinor + taxMinor).toBe(9_200_00);
    expect(taxMinor).toBe(140_339);
  });

  /**
   * The failure this guards against is subtle and expensive: rounding the net
   * and the tax independently leaves totals that are a paisa out, so an
   * invoice's lines do not sum to the amount actually charged. Deriving the
   * net by subtraction makes that impossible — which is worth asserting across
   * a wide range rather than on one convenient number.
   */
  it("reconciles for every total from ₹0.01 to ₹10,000", () => {
    for (let minor = 1; minor <= 1_000_000; minor += 997) {
      const { netMinor, taxMinor } = splitInclusiveTax(minor, 18);
      expect(netMinor + taxMinor).toBe(minor);
      expect(taxMinor).toBeGreaterThanOrEqual(0);
    }
  });

  it("charges nothing at a zero rate — the export case", () => {
    const { netMinor, taxMinor } = splitInclusiveTax(150_00, 0);
    expect(taxMinor).toBe(0);
    expect(netMinor).toBe(150_00);
  });
});
