import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { fulfilOrder } from "@/lib/orders";

/**
 * The once-only claim.
 *
 * Stripe reports a completed payment twice — the browser returning from
 * Checkout, and the webhook — in no guaranteed order, either droppable, either
 * replayable. Two runs of `fulfilOrder` would mean two sets of licence keys
 * against one payment, two allocations consumed, and two confirmation emails.
 *
 * These tests are the reason that claim can be trusted. They need a database,
 * so they skip when DATABASE_URL is unset — `npm test` still works on a laptop
 * with nothing running, and CI starts Postgres and gets the full suite.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("fulfilOrder", () => {
  let userId: string;
  let categoryId: string;
  let brandId: string;
  let variantId: string;
  const made: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `fulfilment.${stamp}@example.test`,
        name: "Fulfilment Test",
        passwordHash: "x",
        passwordSalt: "x",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: { slug: `t-cat-${stamp}`, name: "Test category" },
    });
    categoryId = category.id;

    const brand = await prisma.brand.create({
      data: { slug: `t-brand-${stamp}`, name: "Test brand" },
    });
    brandId = brand.id;

    const product = await prisma.product.create({
      data: {
        slug: `t-product-${stamp}`,
        name: "Test licence",
        brandId,
        categoryId,
        summary: "For tests",
        variants: {
          create: {
            sku: `T-SKU-${stamp}`,
            name: "1 user, 1 year",
            seats: 1,
            prices: {
              create: [
                { currency: "USD", listMinor: 10_000, priceMinor: 9_000 },
                { currency: "INR", listMinor: 800_00, priceMinor: 700_00 },
              ],
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
    await prisma.variant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  /** A PENDING order with two lines, as `placeOrder` would leave it. */
  async function pendingOrder() {
    const number = `VX-TEST-${Math.random().toString(36).slice(2, 10)}`;
    const order = await prisma.order.create({
      data: {
        number,
        userId,
        email: `fulfilment@example.test`,
        phone: "+10000000000",
        currency: "USD",
        country: "US",
        billName: "Fulfilment Test",
        netMinor: 18_000,
        taxMinor: 0,
        totalMinor: 18_000,
        paymentMethod: "CARD",
        paymentStatus: "PENDING",
      },
    });
    made.push(order.id);

    const fulfilment = await prisma.fulfilment.create({
      data: { orderId: order.id, kind: "DIGITAL", status: "PENDING" },
    });

    for (let index = 0; index < 2; index += 1) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          fulfilmentId: fulfilment.id,
          variantId,
          sku: `T-SKU-${index}`,
          name: "Test licence",
          variantName: "1 user, 1 year",
          seats: 1,
          qty: 1,
          unitPriceMinor: 9_000,
        },
      });
    }
    return order;
  }

  const keysOf = (orderId: string) =>
    prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { id: "asc" },
      select: { licenceKey: true },
    });

  it("pays the order and issues a key for every line", async () => {
    const order = await pendingOrder();

    const result = await fulfilOrder(order.id, { intentId: "pi_test" });
    expect(result).toEqual({ fulfilled: true, alreadyDone: false });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paymentStatus).toBe("PAID");
    expect(after.paidAt).not.toBeNull();
    expect(after.stripePaymentIntentId).toBe("pi_test");

    const keys = await keysOf(order.id);
    expect(keys).toHaveLength(2);
    for (const item of keys) {
      expect(item.licenceKey).toMatch(/^VX-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    }
    // Two lines must not share a key.
    expect(new Set(keys.map((k) => k.licenceKey)).size).toBe(2);

    const fulfilment = await prisma.fulfilment.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(fulfilment.status).toBe("ISSUED");
  });

  it("does nothing the second time — the webhook retry case", async () => {
    const order = await pendingOrder();

    await fulfilOrder(order.id);
    const first = await keysOf(order.id);

    const second = await fulfilOrder(order.id);
    expect(second).toEqual({ fulfilled: false, alreadyDone: true });

    expect(await keysOf(order.id)).toEqual(first);

    // And exactly one of each notification, not two.
    const sent = await prisma.notification.count({
      where: { orderId: order.id, template: "order.keys", channel: "EMAIL" },
    });
    expect(sent).toBe(1);
  });

  /**
   * The real race: the browser returning from Stripe and the webhook arriving
   * at the same instant. Only one may issue keys. This fires both without
   * awaiting in between, which is as close to simultaneous as a test gets.
   */
  it("issues one set of keys when both callers arrive together", async () => {
    const order = await pendingOrder();

    const results = await Promise.all([
      fulfilOrder(order.id),
      fulfilOrder(order.id),
      fulfilOrder(order.id),
    ]);

    expect(results.filter((r) => r.fulfilled)).toHaveLength(1);
    expect(results.filter((r) => r.alreadyDone)).toHaveLength(2);

    const keys = await keysOf(order.id);
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.licenceKey !== null)).toBe(true);

    const sent = await prisma.notification.count({
      where: { orderId: order.id, template: "order.keys", channel: "EMAIL" },
    });
    expect(sent).toBe(1);
  });

  it("leaves an order alone once it is not PENDING", async () => {
    const order = await pendingOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REFUNDED" },
    });

    const result = await fulfilOrder(order.id);
    expect(result.alreadyDone).toBe(true);

    const keys = await keysOf(order.id);
    expect(keys.every((k) => k.licenceKey === null)).toBe(true);
  });
});
