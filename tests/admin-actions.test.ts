import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { recordAdminAction } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { fulfilOrder, sendKeys } from "@/lib/orders";

/**
 * What an administrator can do to an order.
 *
 * The two hand-operated changes are recording a bank transfer and sending the
 * keys again. The first issues licences and takes money's word for it, so it
 * runs through the same once-only claim the Stripe webhook uses; the second
 * must never invent a key.
 *
 * The server actions themselves need a request — they read a session cookie and
 * redirect — so what is exercised here is everything they do once the guard has
 * passed. That the guard is there at all is checked structurally, in
 * `admin-guard.test.ts`.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("administering an order", () => {
  const stamp = Date.now();
  let userId: string;
  let categoryId: string;
  let brandId: string;
  let variantId: string;
  const made: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `admin.test.${stamp}@example.test`,
        name: "Admin Test",
        passwordHash: "x",
        passwordSalt: "x",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: { slug: `a-cat-${stamp}`, name: "Test category" },
    });
    categoryId = category.id;
    const brand = await prisma.brand.create({
      data: { slug: `a-brand-${stamp}`, name: "Test brand" },
    });
    brandId = brand.id;

    const product = await prisma.product.create({
      data: {
        slug: `a-product-${stamp}`,
        name: "Test licence",
        brandId,
        categoryId,
        summary: "For tests",
        variants: {
          create: {
            sku: `A-SKU-${stamp}`,
            name: "1 user, 1 year",
            seats: 1,
            prices: {
              create: [{ currency: "INR", listMinor: 1_000_00, priceMinor: 920_00 }],
            },
          },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0].id;
  });

  afterAll(async () => {
    if (!hasDatabase) return;
    for (const orderId of made) {
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    await prisma.adminAction.deleteMany({ where: { actorEmail: `admin.test.${stamp}@example.test` } });
    await prisma.variant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  /** An order awaiting a bank transfer, as checkout leaves one. */
  async function awaitingTransfer() {
    const order = await prisma.order.create({
      data: {
        number: `VX-ADM-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        userId,
        email: `admin.test.${stamp}@example.test`,
        phone: "+919876543210",
        currency: "INR",
        country: "IN",
        billName: "Admin Test",
        netMinor: 779_66,
        taxMinor: 140_34,
        totalMinor: 920_00,
        taxRatePercent: 18,
        taxLabel: "GST",
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PENDING",
      },
    });
    made.push(order.id);

    const fulfilment = await prisma.fulfilment.create({
      data: { orderId: order.id, kind: "DIGITAL", status: "PENDING" },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        fulfilmentId: fulfilment.id,
        variantId,
        sku: `A-SKU-${stamp}`,
        name: "Test licence",
        variantName: "1 user, 1 year",
        seats: 1,
        qty: 1,
        unitPriceMinor: 920_00,
      },
    });
    return order;
  }

  const keysSent = (orderId: string) =>
    prisma.notification.count({
      where: { orderId, template: "order.keys", channel: "EMAIL" },
    });

  it("issues the keys when a transfer is recorded", async () => {
    const order = await awaitingTransfer();

    const result = await fulfilOrder(order.id);
    expect(result.fulfilled).toBe(true);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentStatus).toBe("PAID");

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items.every((item) => item.licenceKey)).toBe(true);
    expect(await keysSent(order.id)).toBe(1);
  });

  /**
   * The click that matters. An administrator pressing the button twice — or
   * pressing it at the moment the money also arrives another way — must issue
   * one set of keys and send one email.
   */
  it("issues one set of keys however many times the button is pressed", async () => {
    const order = await awaitingTransfer();

    const results = await Promise.all([
      fulfilOrder(order.id),
      fulfilOrder(order.id),
      fulfilOrder(order.id),
    ]);
    expect(results.filter((r) => r.fulfilled)).toHaveLength(1);
    expect(await keysSent(order.id)).toBe(1);

    const keys = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      select: { licenceKey: true },
    });
    expect(keys.every((key) => key.licenceKey)).toBe(true);
  });

  it("sends the keys again without issuing new ones", async () => {
    const order = await awaitingTransfer();
    await fulfilOrder(order.id);

    const before = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
      select: { licenceKey: true },
    });

    expect(await sendKeys(order.id)).toBe(true);

    const after = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
      select: { licenceKey: true },
    });
    expect(after).toEqual(before);
    // Two emails now: the one fulfilment sent, and the one just re-sent.
    expect(await keysSent(order.id)).toBe(2);
  });

  /** A resend on an unpaid order would otherwise email the word "pending". */
  it("refuses to send keys for an order that has none", async () => {
    const order = await awaitingTransfer();
    expect(await sendKeys(order.id)).toBe(false);
    expect(await keysSent(order.id)).toBe(0);
  });

  it("writes down who did it", async () => {
    const order = await awaitingTransfer();
    const actor = { email: `admin.test.${stamp}@example.test` } as never;

    await recordAdminAction(
      actor,
      "order.mark-paid",
      order.number,
      'Marked paid on a bank transfer, reference "UTR12345".',
    );

    const [entry] = await prisma.adminAction.findMany({
      where: { subject: order.number },
    });
    expect(entry.actorEmail).toBe(`admin.test.${stamp}@example.test`);
    expect(entry.action).toBe("order.mark-paid");
    expect(entry.detail).toContain("UTR12345");
  });
});
