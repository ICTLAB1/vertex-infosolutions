import { describe, expect, it } from "vitest";

import { compose } from "@/lib/notify";

/**
 * These assertions look pedantic and are not.
 *
 * A licence key or a one-time code that leaks into a WhatsApp template is a
 * credential sitting in a chat thread, forwardable, readable over a shoulder,
 * and outside the address we verified. The rule is easy to break by adding one
 * convenient variable to a template months from now — so it is asserted here
 * rather than left as a comment.
 */
describe("what may travel over WhatsApp", () => {
  it("never sends a one-time code", () => {
    const verify = compose("otp.verify", {
      name: "Anita",
      code: "482913",
      ttl: "10 minutes",
    });
    expect(verify.whatsapp).toBeUndefined();
    expect(verify.body).toContain("482913");

    const signin = compose("otp.signin", {
      name: "Anita",
      code: "482913",
      ttl: "10 minutes",
    });
    expect(signin.whatsapp).toBeUndefined();
  });

  it("never sends a licence key", () => {
    const keys = compose("order.keys", {
      name: "Anita",
      number: "VX-2026-123456",
      keys: "Microsoft 365\n  VX-9EF7-8F88-65F5",
      orderUrl: "https://example.com/account/orders/VX-2026-123456",
    });
    expect(keys.whatsapp).toBeUndefined();
    expect(keys.body).toContain("VX-9EF7-8F88-65F5");
  });

  it("sends an order confirmation, carrying no secret", () => {
    const paid = compose("order.paid", {
      name: "Anita",
      number: "VX-2026-123456",
      total: "₹9,200",
      orderUrl: "https://example.com/account/orders/VX-2026-123456",
      invoiceKind: "GST invoice",
    });

    expect(paid.whatsapp).toBeDefined();
    const variables = paid.whatsapp!.variables.join(" ");
    // A key is VX-XXXX-XXXX-XXXX; an order number is VX-YYYY-NNNNNN. Only the
    // second may appear.
    expect(variables).not.toMatch(/VX-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/);
    expect(variables).toContain("VX-2026-123456");
    expect(variables).toContain("₹9,200");
  });
});

describe("template contents", () => {
  it("gives every message a subject and a body", () => {
    const templates = [
      ["otp.verify", { name: "A", code: "111111", ttl: "10 minutes" }],
      ["otp.signin", { name: "A", code: "111111", ttl: "10 minutes" }],
      ["account.welcome", { name: "A", accountUrl: "https://x/account" }],
      [
        "order.paid",
        {
          name: "A",
          number: "VX-1",
          total: "$1",
          orderUrl: "https://x",
          invoiceKind: "commercial invoice",
        },
      ],
      ["order.keys", { name: "A", number: "VX-1", keys: "k", orderUrl: "https://x" }],
      ["order.pending", { name: "A", number: "VX-1", total: "$1", orderUrl: "https://x" }],
    ] as const;

    for (const [template, data] of templates) {
      const message = compose(template, data as Record<string, string>);
      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.body.length).toBeGreaterThan(0);
      // An unsubstituted placeholder is the classic broken-email bug.
      expect(message.subject).not.toMatch(/\{\{|\$\{|undefined/);
      expect(message.body).not.toMatch(/\{\{|\$\{|undefined/);
    }
  });

  it("puts the code in the subject, where a phone shows it without opening", () => {
    const verify = compose("otp.verify", {
      name: "Anita",
      code: "482913",
      ttl: "10 minutes",
    });
    expect(verify.subject).toContain("482913");
  });
});
