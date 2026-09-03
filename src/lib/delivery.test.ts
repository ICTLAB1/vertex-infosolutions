import { describe, expect, it } from "vitest";

import { deliveryHeadline, deliveryShort, deliverySummary } from "./delivery";

describe("what delivery promises", () => {
  it("never calls a CSP subscription a key", () => {
    // There is no key to redeem: the customer gets the sign-in details for a
    // tenant Microsoft created. Somebody waiting for a code in their inbox is
    // waiting for something that will never arrive.
    for (const text of [
      deliveryHeadline(true),
      deliverySummary(true),
      deliveryShort(true),
    ]) {
      expect(text.toLowerCase()).not.toContain("key");
    }
    expect(deliverySummary(true)).toContain("tenant");
  });

  it("promises a business day, never a minute", () => {
    for (const csp of [true, false]) {
      for (const text of [deliverySummary(csp), deliveryShort(csp)]) {
        expect(text).toContain("within one business day");
        expect(text).not.toMatch(/minute|immediately|instant/i);
      }
    }
  });
});
