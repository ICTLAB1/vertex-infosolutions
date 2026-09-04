import { describe, expect, it } from "vitest";

import { CREDENTIAL_TEMPLATES, compose } from "@/lib/notify";

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
  it("never sends a one-time code", async () => {
    const verify = await compose("otp.verify", {
      name: "Anita",
      code: "482913",
      ttl: "10 minutes",
    });
    expect(verify.whatsapp).toBeUndefined();
    expect(verify.body).toContain("482913");

    const signin = await compose("otp.signin", {
      name: "Anita",
      code: "482913",
      ttl: "10 minutes",
    });
    expect(signin.whatsapp).toBeUndefined();
  });

  it("never sends a licence key", async () => {
    const keys = await compose("order.keys", {
      name: "Anita",
      number: "VX-2026-123456",
      keys: "Microsoft 365\n  VX-9EF7-8F88-65F5",
      orderUrl: "https://example.com/account/orders/VX-2026-123456",
    });
    expect(keys.whatsapp).toBeUndefined();
    expect(keys.body).toContain("VX-9EF7-8F88-65F5");
  });

  it("sends a renewal reminder, carrying no key and no price", async () => {
    const reminder = await compose("licence.expiring", {
      name: "Anita",
      number: "VX-2026-123456",
      summary: "Autodesk AutoCAD",
      licences: "  • Autodesk AutoCAD — 1 user, 1 year",
      expiresOn: "1 Jan 2027",
      days: "30",
      renewUrl: "https://example.com/product/autodesk-autocad",
      accountUrl: "https://example.com/account/licences",
    });

    expect(reminder.whatsapp).toBeDefined();
    const variables = reminder.whatsapp!.variables.join(" ");
    expect(variables).not.toMatch(/VX-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/);
    // What it may say: who, what, when. The nudge is to open the account, and
    // everything sensitive stays there.
    expect(variables).toContain("Anita");
    expect(variables).toContain("Autodesk AutoCAD");
    expect(variables).toContain("1 Jan 2027");

    // And the email is unambiguous that this is not a charge, because a
    // renewal notice that reads like an invoice gets paid twice.
    expect(reminder.body).toContain("This is a reminder, not a charge");
  });

  it("sends an order confirmation, carrying no secret", async () => {
    const paid = await compose("order.paid", {
      name: "Anita",
      number: "VX-2026-123456",
      total: "₹9,200",
      orderUrl: "https://example.com/account/orders/VX-2026-123456",
      invoiceKind: "GST invoice",
      invoiceUrl: "https://example.com/account/orders/VX-2026-123456/invoice",
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
  it("gives every message a subject and a body", async () => {
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
          invoiceUrl: "https://x/invoice",
        },
      ],
      ["order.keys", { name: "A", number: "VX-1", keys: "k", orderUrl: "https://x" }],
      ["order.pending", { name: "A", number: "VX-1", total: "$1", orderUrl: "https://x" }],
      [
        "licence.expiring",
        {
          name: "A",
          number: "VX-1",
          summary: "A licence",
          licences: "  • A licence — 1 user",
          expiresOn: "1 Jan 2027",
          days: "30",
          renewUrl: "https://x/product/a",
          accountUrl: "https://x/account/licences",
        },
      ],
    ] as const;

    for (const [template, data] of templates) {
      const message = await compose(template, data as Record<string, string>);
      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.body.length).toBeGreaterThan(0);
      // An unsubstituted placeholder is the classic broken-email bug.
      expect(message.subject).not.toMatch(/\{\{|\$\{|undefined/);
      expect(message.body).not.toMatch(/\{\{|\$\{|undefined/);
    }
  });

  it("puts the code in the subject, where a phone shows it without opening", async () => {
    const verify = await compose("otp.verify", {
      name: "Anita",
      code: "482913",
      ttl: "10 minutes",
    });
    expect(verify.subject).toContain("482913");
  });
});

/**
 * Which messages an administrator may redirect.
 *
 * `/admin/messages` can point a bounced message at a corrected address — the
 * commonest reason a message is abandoned is a typo in one. That must never
 * extend to a message that carries the credential itself: sending a licence
 * key or a one-time code to an address somebody chose in a form is the whole
 * of an attack.
 *
 * The list is a constant, so this checks the constant against what the
 * templates actually render. A new template that puts a key in its body is the
 * mistake being guarded against, and it would pass a test that only read the
 * list.
 */
describe("what may not be redirected", () => {
  const CODE = "482913";
  const KEY = "VX-9EF7-8F88-65F5";

  const samples: Record<string, Record<string, string>> = {
    "otp.verify": { name: "Anita", code: CODE, ttl: "10 minutes" },
    "otp.signin": { name: "Anita", code: CODE, ttl: "10 minutes" },
    "otp.reset": { name: "Anita", code: CODE, ttl: "10 minutes" },
    "order.keys": {
      name: "Anita",
      number: "VX-2026-123456",
      keys: `Microsoft 365\n  ${KEY}`,
      orderUrl: "https://example.com/account/orders/VX-2026-123456",
    },
  };

  it("covers every template that renders a code or a key", async () => {
    for (const [template, data] of Object.entries(samples)) {
      const mail = await compose(template as Parameters<typeof compose>[0], data);
      const carries = mail.body.includes(CODE) || mail.body.includes(KEY);
      expect(carries, `${template} sample does not exercise the credential`).toBe(
        true,
      );
      expect(
        CREDENTIAL_TEMPLATES,
        `${template} renders a credential and must not be redirectable`,
      ).toContain(template);
    }
  });

  it("also covers the one that says a password just changed", async () => {
    // Not a credential itself, but the message somebody would want redirected
    // away from the real owner while taking over an account.
    expect(CREDENTIAL_TEMPLATES).toContain("account.password-changed");
  });

  it("leaves the ordinary messages redirectable", async () => {
    // The whole point of the feature: a confirmation that bounced on a typo.
    for (const template of [
      "order.paid",
      "order.pending",
      "licence.expiring",
      "account.welcome",
      "enquiry.acknowledged",
    ] as const) {
      expect(CREDENTIAL_TEMPLATES).not.toContain(template);
    }
  });
});

/**
 * The message that tells the shop a sale happened.
 *
 * A customer's confirmation was never proof that anybody here saw the order.
 * These assert the two things somebody scanning a phone notification needs
 * from the subject line alone — which order, and whether money has arrived —
 * and that the two states do not read alike.
 */
describe("admin.order", () => {
  const base = {
    number: "VX-2026-430535",
    customer: "A Buyer",
    customerEmail: "buyer@example.test",
    total: "$138.00",
    taxNote: "zero-rated export, no Indian tax",
    method: "Bank transfer",
    market: "USD · AE",
    lines: "  1 × Microsoft 365 Business Standard — 1 licence, 1 year",
    adminUrl: "https://www.vertexinfosolutions.com/admin/orders/VX-2026-430535",
  };

  it("says which order and how much in the subject", async () => {
    const paid = await compose("admin.order", { ...base, state: "paid" });
    expect(paid.subject).toContain("VX-2026-430535");
    expect(paid.subject).toContain("$138.00");
    expect(paid.subject).toContain("paid");
  });

  it("does not let an unpaid order read like a paid one", async () => {
    const pending = await compose("admin.order", { ...base, state: "pending" });
    expect(pending.subject).toContain("pending");
    expect(pending.body).toContain("Awaiting payment");
    expect(pending.body).toContain("matched against the statement");
    expect(pending.body).not.toContain("keys have been issued");
  });

  it("carries the customer, the lines and a way in", async () => {
    const paid = await compose("admin.order", { ...base, state: "paid" });
    expect(paid.body).toContain("buyer@example.test");
    expect(paid.body).toContain("Microsoft 365 Business Standard");
    expect(paid.body).toContain(base.adminUrl);
  });

  it("is email only — WhatsApp to the shop would need Meta's approval", async () => {
    const paid = await compose("admin.order", { ...base, state: "paid" });
    expect(paid.whatsapp).toBeUndefined();
  });
});
