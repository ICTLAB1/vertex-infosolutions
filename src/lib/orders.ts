import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notify";
import { expiryFor } from "@/lib/renewals";
import { appUrl } from "@/lib/stripe";

/** VX-4F2A-9C31-8BE0 — grouped so it can be read aloud on a support call. */
function licenceKey(): string {
  const block = () => randomBytes(2).toString("hex").toUpperCase();
  return `VX-${block()}-${block()}-${block()}`;
}

/**
 * Mark an order paid, issue its licence keys, and tell the customer.
 *
 * **This must happen exactly once, and it is called more than once by design.**
 * Stripe reports a completed payment twice — the browser returning from the
 * hosted page, and the webhook — in no guaranteed order, either of which can be
 * lost or replayed. Two runs would mean two sets of keys against one payment,
 * two allocations consumed, and two confirmation emails.
 *
 * So the claim is a conditional update: `paymentStatus` moves PENDING → PAID in
 * one statement, and the row count decides. The database serialises the two
 * callers; whichever loses gets zero rows and returns `alreadyDone`. No lock,
 * no queue, no window.
 */
export async function fulfilOrder(
  orderId: string,
  payment: { intentId?: string | null } = {},
): Promise<{ fulfilled: boolean; alreadyDone: boolean }> {
  const now = new Date();

  const claimed = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "PENDING" },
    data: {
      paymentStatus: "PAID",
      paidAt: now,
      ...(payment.intentId ? { stripePaymentIntentId: payment.intentId } : {}),
    },
  });

  if (claimed.count === 0) {
    return { fulfilled: false, alreadyDone: true };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      // The product's term decides when the licence expires, so it is read
      // here and written onto the line — a historic purchase then keeps the
      // dates it was actually sold under, even if the term is renegotiated.
      items: { include: { variant: { select: { product: { select: { term: true } } } } } },
      fulfilments: true,
    },
  });
  if (!order) return { fulfilled: false, alreadyDone: false };

  // Keys are generated only for lines that do not have one. A retry that got
  // this far — the claim succeeded but the process died before finishing —
  // completes rather than duplicating.
  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.licenceKey) continue;
      const term = item.variant?.product.term ?? "ANNUAL_SUBSCRIPTION";
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          licenceKey: licenceKey(),
          // Null for a perpetual licence, which never expires.
          expiresAt: expiryFor(term, now),
        },
      });
    }
    await tx.fulfilment.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "ISSUED", completedAt: now },
    });
  });

  const currency = order.currency as CurrencyCode;
  const orderUrl = `${appUrl()}/account/orders/${order.number}`;

  // Notifications come after the money and the keys are settled, and never
  // inside the transaction: a mail provider being down must not roll back a
  // payment that has already been taken.
  await notify(
    "order.paid",
    {
      userId: order.userId,
      orderId: order.id,
      email: order.email,
      phone: order.user.phone,
      whatsappOptIn: order.user.whatsappOptIn,
    },
    {
      name: order.user.name,
      number: order.number,
      total: formatMoney(order.totalMinor, currency),
      orderUrl,
      invoiceKind: order.country === "IN" ? "GST invoice" : "commercial invoice",
      invoiceUrl: `${orderUrl}/invoice`,
    },
  );

  await sendKeys(orderId);

  return { fulfilled: true, alreadyDone: false };
}

/**
 * Send the licence keys for an order.
 *
 * Separate from `fulfilOrder` because it is also the thing an administrator
 * reaches for when a customer says the email never arrived — a bounced address
 * now fixed, a spam filter, a forwarding rule. It re-reads the keys rather than
 * taking them from a caller, so a resend cannot invent one, and it issues
 * nothing: an order with no keys yet gets no email.
 */
export async function sendKeys(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!order) return false;
  if (!order.items.some((item) => item.licenceKey)) return false;

  await notify(
    "order.keys",
    {
      userId: order.userId,
      orderId: order.id,
      email: order.email,
      phone: order.user.phone,
      whatsappOptIn: order.user.whatsappOptIn,
    },
    {
      name: order.user.name,
      number: order.number,
      keys: order.items
        .map((item) =>
          [
            `${item.name} — ${item.variantName}`,
            // The publisher's own number, so the customer can file this
            // against a purchase order or quote it to the publisher's support
            // without going back to the website for it.
            item.partNumber ? `  ${item.partNumber}` : null,
            `  ${item.licenceKey ?? "pending"}`,
          ]
            .filter((line) => line !== null)
            .join("\n"),
        )
        .join("\n\n"),
      orderUrl: `${appUrl()}/account/orders/${order.number}`,
    },
  );
  return true;
}

/** Tell the customer we are waiting on their bank transfer. */
export async function notifyPending(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  if (!order) return;

  await notify(
    "order.pending",
    {
      userId: order.userId,
      orderId: order.id,
      email: order.email,
      phone: order.user.phone,
      whatsappOptIn: order.user.whatsappOptIn,
    },
    {
      name: order.user.name,
      number: order.number,
      total: formatMoney(order.totalMinor, order.currency as CurrencyCode),
      orderUrl: `${appUrl()}/account/orders/${order.number}`,
    },
  );
}
