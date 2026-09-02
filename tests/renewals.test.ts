import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { REMIND_DAYS_AHEAD, sendRenewalReminders } from "@/lib/renewals";

/**
 * The reminder sweep.
 *
 * Five pages and the welcome email promise that nothing renews behind the
 * customer's back and that we warn a month ahead. A reminder that goes twice is
 * a nuisance; one that never goes is a broken promise and, with Autodesk,
 * usually a repurchase at list price. These tests hold both ends.
 *
 * They need a database, so they skip when DATABASE_URL is unset — `npm test`
 * still works on a laptop with nothing running, and CI starts Postgres and gets
 * the full suite.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("sendRenewalReminders", () => {
  const stamp = Date.now();
  let userId: string;
  let categoryId: string;
  let brandId: string;
  let variantId: string;
  const made: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `renewals.${stamp}@example.test`,
        name: "Renewal Test",
        phone: "+10000000000",
        whatsappOptIn: true,
        passwordHash: "x",
        passwordSalt: "x",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: { slug: `r-cat-${stamp}`, name: "Test category" },
    });
    categoryId = category.id;

    const brand = await prisma.brand.create({
      data: { slug: `r-brand-${stamp}`, name: "Test brand" },
    });
    brandId = brand.id;

    const product = await prisma.product.create({
      data: {
        slug: `r-product-${stamp}`,
        name: "Test licence",
        brandId,
        categoryId,
        summary: "For tests",
        term: "ANNUAL_SUBSCRIPTION",
        variants: {
          create: {
            sku: `R-SKU-${stamp}`,
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

  const inDays = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  };

  /** A paid order whose lines expire on the given day. */
  async function paidOrder(
    options: {
      expiresIn?: number | null;
      lines?: number;
      paid?: boolean;
      keys?: boolean;
    } = {},
  ) {
    const { expiresIn = 10, lines = 1, paid = true, keys = true } = options;

    const order = await prisma.order.create({
      data: {
        number: `VX-REN-${Math.random().toString(36).slice(2, 10)}`,
        userId,
        email: `renewals.${stamp}@example.test`,
        phone: "+10000000000",
        currency: "USD",
        country: "US",
        billName: "Renewal Test",
        netMinor: 9_000 * lines,
        taxMinor: 0,
        totalMinor: 9_000 * lines,
        paymentMethod: "CARD",
        paymentStatus: paid ? "PAID" : "PENDING",
        paidAt: paid ? new Date() : null,
      },
    });
    made.push(order.id);

    const fulfilment = await prisma.fulfilment.create({
      data: {
        orderId: order.id,
        kind: "DIGITAL",
        status: paid ? "ISSUED" : "PENDING",
      },
    });

    for (let index = 0; index < lines; index += 1) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          fulfilmentId: fulfilment.id,
          variantId,
          sku: `R-SKU-${index}`,
          name: `Test licence ${index + 1}`,
          variantName: "1 user, 1 year",
          seats: 1,
          qty: 1,
          unitPriceMinor: 9_000,
          licenceKey: keys ? `VX-TEST-KEY-${index}-${Math.random()}` : null,
          expiresAt: expiresIn === null ? null : inDays(expiresIn),
        },
      });
    }
    return order;
  }

  const remindersFor = (orderId: string) =>
    prisma.notification.findMany({
      where: { orderId, template: "licence.expiring", channel: "EMAIL" },
    });

  it("reminds about a licence inside the window, once", async () => {
    const order = await paidOrder({ expiresIn: 10 });

    const first = await sendRenewalReminders();
    expect(first.reminded).toBeGreaterThanOrEqual(1);

    const sent = await remindersFor(order.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toContain("in 10 days");
    expect(sent[0].body).toContain("Nothing renews automatically here");

    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
    });
    expect(items.every((item) => item.renewalRemindedAt !== null)).toBe(true);

    // The second sweep, the day after, or a scheduler that fires twice.
    await sendRenewalReminders();
    expect(await remindersFor(order.id)).toHaveLength(1);
  });

  it("sends one message for an order of several licences, not one each", async () => {
    const order = await paidOrder({ expiresIn: 12, lines: 3 });

    await sendRenewalReminders();

    const sent = await remindersFor(order.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("and 2 other licences");
    // And every line is named in the body, so it is a summary and not a
    // truncation.
    expect(sent[0].body).toContain("Test licence 1");
    expect(sent[0].body).toContain("Test licence 2");
    expect(sent[0].body).toContain("Test licence 3");
  });

  /**
   * A licence key in a reminder would be a key in a mailbox that gets
   * forwarded, and on WhatsApp it would be a key in a chat thread. The keys
   * live in the account; the reminder links to it.
   */
  it("never repeats the licence key", async () => {
    const order = await paidOrder({ expiresIn: 8 });
    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
    });

    await sendRenewalReminders();

    const all = await prisma.notification.findMany({
      where: { orderId: order.id },
    });
    expect(all.length).toBeGreaterThan(0);
    for (const message of all) {
      expect(message.body).not.toContain(item.licenceKey);
    }
  });

  it("leaves alone what is not due", async () => {
    const beyond = await paidOrder({ expiresIn: REMIND_DAYS_AHEAD + 1 });
    const gone = await paidOrder({ expiresIn: -1 });
    const unpaid = await paidOrder({ expiresIn: 5, paid: false });
    const unissued = await paidOrder({ expiresIn: 5, keys: false });
    const perpetual = await paidOrder({ expiresIn: null });

    await sendRenewalReminders();

    for (const order of [beyond, gone, unpaid, unissued, perpetual]) {
      expect(await remindersFor(order.id)).toHaveLength(0);
    }

    // An expiry that slipped past unreminded keeps its null stamp rather than
    // being marked done, so the miss stays visible.
    const missed = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: gone.id },
    });
    expect(missed.renewalRemindedAt).toBeNull();
  });

  it("reminds on the last day of the window and on the day itself", async () => {
    const edge = await paidOrder({ expiresIn: REMIND_DAYS_AHEAD });
    const today = await paidOrder({ expiresIn: 0 });

    await sendRenewalReminders();

    expect(await remindersFor(edge.id)).toHaveLength(1);
    expect(await remindersFor(today.id)).toHaveLength(1);
  });

  /**
   * Two schedulers, or a retry that overlaps the run it is retrying. The claim
   * is a conditional update, so the loser finds nothing left to claim.
   */
  it("sends once when two sweeps run at the same instant", async () => {
    const order = await paidOrder({ expiresIn: 15 });

    await Promise.all([
      sendRenewalReminders(),
      sendRenewalReminders(),
      sendRenewalReminders(),
    ]);

    expect(await remindersFor(order.id)).toHaveLength(1);
  });
});
