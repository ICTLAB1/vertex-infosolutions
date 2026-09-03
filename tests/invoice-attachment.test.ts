import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { invoiceAttachment, invoiceById } from "@/lib/invoice";
import { attachmentsFor } from "@/lib/notify";

/**
 * The invoice on the confirmation email.
 *
 * A link in an email is not a document: it needs an account, a password, and
 * the store still being there in three years when an auditor asks. The file
 * itself is what a finance team files.
 *
 * It is rendered at send time and never stored, which is what lets a retry
 * days later attach the same document without the outbox carrying a copy of
 * every PDF it ever sent.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("the invoice as an attachment", () => {
  const stamp = Date.now();
  let userId: string;
  let orderId: string;
  let orderNumber: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `attach.${stamp}@example.test`,
        name: "Attachment Test",
        passwordHash: "x",
        passwordSalt: "x",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    orderNumber = `VX-ATT-${stamp.toString(36).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        number: orderNumber,
        userId,
        email: user.email,
        phone: "+919876543210",
        currency: "INR",
        country: "IN",
        billName: "Attachment Test",
        billCompany: "Sharma Engineering Services Pvt Ltd",
        billCity: "Pune",
        gstin: "27AABCU9603R1ZM",
        netMinor: 7_796_61,
        taxMinor: 1_403_39,
        totalMinor: 9_200_00,
        taxRatePercent: 18,
        taxLabel: "GST",
        paymentMethod: "CARD",
        paymentStatus: "PAID",
        paidAt: new Date(),
      },
    });
    orderId = order.id;

    const fulfilment = await prisma.fulfilment.create({
      data: { orderId, kind: "DIGITAL", status: "ISSUED" },
    });
    await prisma.orderItem.create({
      data: {
        orderId,
        fulfilmentId: fulfilment.id,
        sku: `ATT-${stamp}`,
        name: "Microsoft 365 Business Standard",
        variantName: "1 user, 1 year",
        seats: 1,
        qty: 1,
        unitPriceMinor: 9_200_00,
        sacCode: "997331",
        licenceKey: "VX-TEST-KEY-ATT",
      },
    });
  });

  afterAll(async () => {
    if (!hasDatabase) return;
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("builds the invoice from the order id", async () => {
    const invoice = await invoiceById(orderId);
    expect(invoice?.number).toBe(orderNumber);
    expect(invoice?.kind).toBe("tax");
    expect(invoice?.totalMinor).toBe(9_200_00);
  });

  it("is a real PDF, named for the order", async () => {
    const attachment = await invoiceAttachment(orderId);
    expect(attachment?.filename).toBe(`tax-invoice-${orderNumber}.pdf`);

    const bytes = Buffer.from(attachment!.content, "base64");
    expect(bytes.subarray(0, 8).toString()).toBe("%PDF-1.7");
    expect(bytes.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  /**
   * Only the confirmation. A one-time code or a renewal reminder has no
   * invoice to carry, and attaching one to a licence-key email would put the
   * customer's billing address in a second place it does not need to be.
   */
  it("goes on the confirmation and nothing else", async () => {
    expect(await attachmentsFor("order.paid", orderId)).toHaveLength(1);

    for (const template of [
      "order.keys",
      "order.pending",
      "otp.verify",
      "otp.reset",
      "licence.expiring",
      "account.welcome",
    ] as const) {
      expect(await attachmentsFor(template, orderId), template).toEqual([]);
    }
  });

  it("carries nothing rather than failing when there is no order", async () => {
    expect(await attachmentsFor("order.paid", null)).toEqual([]);
    expect(await attachmentsFor("order.paid", "no-such-order")).toEqual([]);
    expect(await invoiceAttachment("no-such-order")).toBeNull();
  });
});
