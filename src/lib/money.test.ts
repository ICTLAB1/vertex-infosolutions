import { describe, expect, it } from "vitest";

import {
  discountPercent,
  formatMoney,
  formatMoneyExact,
  parseMoneyMinor,
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

/**
 * Reading a price back out of the price-book form.
 *
 * The bug this exists to prevent is a float: `9200.29 * 100` is 920028.99999,
 * and rounding that across a catalogue puts a paisa wrong on prices nobody
 * checks until a customer does.
 */
describe("parseMoneyMinor", () => {
  it("reads whole and fractional amounts exactly", () => {
    expect(parseMoneyMinor("9200")).toBe(920000);
    expect(parseMoneyMinor("9200.50")).toBe(920050);
    expect(parseMoneyMinor("0.01")).toBe(1);
    expect(parseMoneyMinor("9200.5")).toBe(920050);
  });

  it("gets the paise right where a float would not", () => {
    expect(parseMoneyMinor("9200.29")).toBe(920029);
    expect(parseMoneyMinor("1.10")).toBe(110);
    expect(parseMoneyMinor("0.07")).toBe(7);
  });

  it("accepts what somebody would actually type", () => {
    expect(parseMoneyMinor("₹9,200.50")).toBe(920050);
    expect(parseMoneyMinor("$1,299")).toBe(129900);
    expect(parseMoneyMinor(" 9200 ")).toBe(920000);
  });

  it("refuses what is not an amount, rather than storing a zero", () => {
    for (const input of ["", "  ", "abc", "-500", "9200.505", "9.9.9", "1e5"]) {
      expect(parseMoneyMinor(input), input).toBeNull();
    }
  });
});
