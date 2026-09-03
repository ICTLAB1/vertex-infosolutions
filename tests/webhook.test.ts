import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/webhooks/stripe/route";
import { prisma } from "@/lib/db";

/**
 * The webhook is the authority on whether an order was paid, and it is
 * reachable by anyone on the internet. Without signature verification it is an
 * unauthenticated "mark my order paid" button.
 *
 * Stripe's signature is an HMAC over `${timestamp}.${payload}` using the
 * endpoint secret — verified locally, with no call to Stripe — so the whole
 * security boundary is testable here. The route handler is an ordinary
 * function, so it is called directly rather than over a socket.
 */
const SECRET = "whsec_test_secret_for_the_suite";
const hasDatabase = Boolean(process.env.DATABASE_URL);

function sign(payload: string, secret = SECRET, timestamp?: number): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  return `t=${t},v1=${signature}`;
}

function request(payload: string, signature: string | null): Request {
  return new Request("https://example.test/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body: payload,
  });
}

describe.skipIf(!hasDatabase)("stripe webhook", () => {
  let userId: string;
  let categoryId: string;
  let brandId: string;
  const made: string[] = [];

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_suite_local_only";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;

    const stamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `webhook.${stamp}@example.test`,
        name: "Webhook Test",
        passwordHash: "x",
        passwordSalt: "x",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: { slug: `w-cat-${stamp}`, name: "Webhook category" },
    });
    categoryId = category.id;
    const brand = await prisma.brand.create({
      data: { slug: `w-brand-${stamp}`, name: "Webhook brand" },
    });
    brandId = brand.id;
  });

  afterAll(async () => {
    if (!hasDatabase) return;
    for (const orderId of made) {
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  async function pendingOrder() {
    const number = `VX-WH-${Math.random().toString(36).slice(2, 10)}`;
    const order = await prisma.order.create({
      data: {
        number,
        userId,
        email: "webhook@example.test",
        phone: "+10000000000",
        currency: "USD",
        country: "US",
        billName: "Webhook Test",
        netMinor: 9_000,
        taxMinor: 0,
        totalMinor: 9_000,
        paymentMethod: "CARD",
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
        sku: "W-SKU",
        name: "Webhook licence",
        variantName: "1 user, 1 year",
        seats: 1,
        qty: 1,
        unitPriceMinor: 9_000,
      },
    });
    return order;
  }

  function paidEvent(orderId: string, orderNumber: string): string {
    return JSON.stringify({
      id: `evt_${orderId}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${orderId}`,
          object: "checkout.session",
          payment_status: "paid",
          payment_intent: "pi_suite",
          metadata: { orderId, orderNumber },
        },
      },
    });
  }

  const statusOf = async (id: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id } })).paymentStatus;

  it("refuses a request with no signature", async () => {
    const order = await pendingOrder();
    const response = await POST(request(paidEvent(order.id, order.number), null));
    expect(response.status).toBe(400);
    expect(await statusOf(order.id)).toBe("PENDING");
  });

  it("refuses a signature made with the wrong secret", async () => {
    const order = await pendingOrder();
    const payload = paidEvent(order.id, order.number);
    const response = await POST(request(payload, sign(payload, "whsec_wrong")));
    expect(response.status).toBe(400);
    expect(await statusOf(order.id)).toBe("PENDING");
  });

  it("refuses a signature from an hour ago", async () => {
    // Stripe's tolerance window is what stops a captured request being
    // replayed indefinitely.
    const order = await pendingOrder();
    const payload = paidEvent(order.id, order.number);
    const old = Math.floor(Date.now() / 1000) - 3600;
    const response = await POST(request(payload, sign(payload, SECRET, old)));
    expect(response.status).toBe(400);
    expect(await statusOf(order.id)).toBe("PENDING");
  });

  it("refuses a tampered body carrying a valid signature for the original", async () => {
    const order = await pendingOrder();
    const payload = paidEvent(order.id, order.number);
    const signature = sign(payload);
    const tampered = payload.replace('"unit_amount"', '"tampered"');
    const response = await POST(request(tampered + " ", signature));
    expect(response.status).toBe(400);
    expect(await statusOf(order.id)).toBe("PENDING");
  });

  it("accepts a correctly signed event and issues the keys", async () => {
    const order = await pendingOrder();
    const payload = paidEvent(order.id, order.number);
    const response = await POST(request(payload, sign(payload)));
    expect(response.status).toBe(200);

    expect(await statusOf(order.id)).toBe("PAID");
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items.every((i) => i.licenceKey !== null)).toBe(true);
  });

  it("is idempotent when Stripe retries the same event", async () => {
    const order = await pendingOrder();
    const payload = paidEvent(order.id, order.number);

    await POST(request(payload, sign(payload)));
    const first = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
      select: { licenceKey: true },
    });

    const second = await POST(request(payload, sign(payload)));
    expect(second.status).toBe(200);

    const after = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
      select: { licenceKey: true },
    });
    expect(after).toEqual(first);
  });

  it("does not un-pay an order when a late failure event arrives", async () => {
    const order = await pendingOrder();
    const paid = paidEvent(order.id, order.number);
    await POST(request(paid, sign(paid)));
    expect(await statusOf(order.id)).toBe("PAID");

    const expired = JSON.stringify({
      id: `evt_expired_${order.id}`,
      object: "event",
      type: "checkout.session.expired",
      data: {
        object: {
          id: `cs_${order.id}`,
          object: "checkout.session",
          payment_status: "unpaid",
          metadata: { orderId: order.id, orderNumber: order.number },
        },
      },
    });
    const response = await POST(request(expired, sign(expired)));
    expect(response.status).toBe(200);
    // A retry that succeeded must not be walked backwards by a late failure
    // event belonging to an earlier attempt.
    expect(await statusOf(order.id)).toBe("PAID");
  });

  it("marks a still-pending order failed when its session expires", async () => {
    const order = await pendingOrder();
    const expired = JSON.stringify({
      id: `evt_expired2_${order.id}`,
      object: "event",
      type: "checkout.session.expired",
      data: {
        object: {
          id: `cs_${order.id}`,
          object: "checkout.session",
          payment_status: "unpaid",
          metadata: { orderId: order.id, orderNumber: order.number },
        },
      },
    });
    await POST(request(expired, sign(expired)));
    expect(await statusOf(order.id)).toBe("FAILED");
  });

  it("acknowledges an event type it does not handle, rather than retrying forever", async () => {
    const payload = JSON.stringify({
      id: "evt_ignored",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_1", object: "customer" } },
    });
    const response = await POST(request(payload, sign(payload)));
    expect(response.status).toBe(200);
  });
});
