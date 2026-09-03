import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { compose } from "@/lib/notify";
import {
  ENQUIRY_LIMITS,
  KIND_LABELS,
  enquiryLimitReached,
  looksLikeEmail,
  recordEnquiry,
} from "@/lib/enquiries";

/**
 * The contact form is the only way into this shop that does not need an
 * account, which makes it the only surface a stranger can write to. Two things
 * therefore matter: that a real question is never rejected, and that a script
 * submitting in a loop is.
 */
describe("recognising an email address", () => {
  it("accepts the addresses real people have", () => {
    for (const address of [
      "anita@example.com",
      "a.b+tag@sub.example.co.in",
      "first-last@example.travel",
      "x@y.io",
    ]) {
      expect(looksLikeEmail(address), address).toBe(true);
    }
  });

  it("rejects what is plainly not one", () => {
    for (const address of [
      "",
      "anita",
      "anita@",
      "@example.com",
      "anita@example",
      "anita @example.com",
      "anita@exam ple.com",
      "anita@example.c",
    ]) {
      expect(looksLikeEmail(address), address).toBe(false);
    }
  });
});

describe("how an enquiry reads to us", () => {
  it("keeps the blank lines that separate header from message", () => {
    const mail = compose("enquiry.received", {
      kindLabel: KIND_LABELS.VOLUME_QUOTE,
      name: "Anita",
      email: "anita@example.com",
      company: "",
      phone: "",
      message: "Twenty seats of Acrobat, annual.",
      productSlug: "",
      market: "USD · AE",
      adminUrl: "https://example.com/admin/enquiries",
    });

    // The optional rows are gone; the separators that make it readable are not.
    expect(mail.body).not.toContain("Company:");
    expect(mail.body).not.toContain("Phone:");
    expect(mail.body).toContain(
      "Market:  USD · AE\n\nTwenty seats of Acrobat, annual.\n\nReply to them",
    );
    expect(mail.subject).toBe("Volume quote request from Anita");
  });

  it("names the company in the subject when there is one", () => {
    const mail = compose("enquiry.received", {
      kindLabel: KIND_LABELS.GENERAL,
      name: "Anita",
      email: "anita@example.com",
      company: "Northwind",
      phone: "",
      message: "A question.",
      productSlug: "",
      market: "INR · IN",
      adminUrl: "https://example.com/admin/enquiries",
    });
    expect(mail.subject).toBe("Enquiry from Anita (Northwind)");
    expect(mail.body).toContain("Company: Northwind");
  });

  it("never sends the acknowledgement over WhatsApp", () => {
    // The acknowledgement quotes back whatever they wrote, which may be
    // anything at all. It belongs in the mailbox they gave us and nowhere else.
    const mail = compose("enquiry.acknowledged", {
      name: "Anita",
      kindLabel: KIND_LABELS.LICENSING,
      message: "Can I move this licence to a new tenant?",
    });
    expect(mail.whatsapp).toBeUndefined();
    expect(mail.body).toContain("Can I move this licence to a new tenant?");
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("recording and limiting enquiries", () => {
  const stamp = Date.now();
  const ip = `203.0.113.${stamp % 200}`;
  const made: string[] = [];

  afterAll(async () => {
    if (made.length > 0) {
      await prisma.enquiry.deleteMany({ where: { id: { in: made } } });
    }
  });

  it("stores what was sent, normalised and bounded", async () => {
    const enquiry = await recordEnquiry({
      kind: "VOLUME_QUOTE",
      name: "Anita Rao",
      email: "  ANITA@Example.COM  ".trim(),
      company: "Northwind",
      phone: "",
      message: "x".repeat(5_000),
      productSlug: "microsoft-365-business-standard",
      currency: "USD",
      country: "AE",
      ip,
    });
    made.push(enquiry.id);

    const stored = await prisma.enquiry.findUniqueOrThrow({
      where: { id: enquiry.id },
    });
    // Lower-cased, so the same person writing twice is one person.
    expect(stored.email).toBe("anita@example.com");
    // An empty optional field is absent, not an empty string pretending to be
    // a phone number.
    expect(stored.phone).toBeNull();
    // Bounded, so one paste cannot fill the column.
    expect(stored.message.length).toBe(4_000);
    expect(stored.handledAt).toBeNull();
  });

  it("lets somebody correct a typo and send again, then stops a loop", async () => {
    // One short of the limit: still open, because resending after spotting a
    // mistake is the commonest reason to submit twice.
    for (let i = made.length; i < ENQUIRY_LIMITS.perIp - 1; i += 1) {
      const enquiry = await recordEnquiry({
        kind: "GENERAL",
        name: "Anita",
        email: "anita@example.com",
        message: "Asking again.",
        ip,
      });
      made.push(enquiry.id);
    }
    expect(await enquiryLimitReached(ip)).toBe(false);

    const last = await recordEnquiry({
      kind: "GENERAL",
      name: "Anita",
      email: "anita@example.com",
      message: "And again.",
      ip,
    });
    made.push(last.id);
    expect(await enquiryLimitReached(ip)).toBe(true);
  });

  it("counts per address, so one caller cannot silence another", async () => {
    expect(await enquiryLimitReached(`198.51.100.${stamp % 200}`)).toBe(false);
  });

  it("never limits a caller whose address the edge did not report", async () => {
    // "unknown" is not an address, it is every caller behind a proxy that sent
    // no header. Counting them together would let one script lock out the rest.
    expect(await enquiryLimitReached("unknown")).toBe(false);
  });

  it("ignores enquiries older than the window", async () => {
    const old = await prisma.enquiry.create({
      data: {
        kind: "GENERAL",
        name: "Old",
        email: "old@example.com",
        message: "From last week.",
        ip: `192.0.2.${stamp % 200}`,
        createdAt: new Date(
          Date.now() - (ENQUIRY_LIMITS.windowMinutes + 5) * 60 * 1000,
        ),
      },
    });
    made.push(old.id);
    expect(await enquiryLimitReached(`192.0.2.${stamp % 200}`)).toBe(false);
  });
});
