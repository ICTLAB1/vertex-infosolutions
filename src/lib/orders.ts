import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notify";
import { expiryFor } from "@/lib/renewals";
import { appUrl } from "@/lib/stripe";
import { shopInboxes } from "@/lib/admin";
import { bankTransferLines, getSiteConfig } from "@/lib/site";

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
/**
 * Tell the shop an order exists.
 *
 * The customer's confirmation has never been proof that anybody here saw it.
 * A bank transfer has to be watched for on a statement, a card order has to
 * have its licences checked, and both can go wrong in a way only a person
 * notices — so this goes to the support address and to everyone who can open
 * the back office, at the moment the order becomes real.
 *
 * Nothing it does can fail the order. It runs after the money and the keys are
 * settled, `notify` records rather than throws, and a shop with no support
 * address configured simply sends nothing: the order is in the back office
 * either way, and an unreachable mailbox must never unwind a payment that has
 * already been taken.
 */
async function alertTheShop(
  orderId: string,
  state: "paid" | "pending",
): Promise<void> {
  const inboxes = await shopInboxes();
  if (inboxes.length === 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!order) return;

  const currency = order.currency as CurrencyCode;
  const lines = order.items
    .map(
      (item) =>
        `  ${item.qty} × ${item.name} — ${item.variantName}` +
        `\n      ${item.partNumber ?? item.sku} · ${formatMoney(item.unitPriceMinor, currency)} each`,
    )
    .join("\n");

  const data = {
    number: order.number,
    state,
    customer: order.user.name,
    customerEmail: order.email,
    total: formatMoney(order.totalMinor, currency),
    taxNote:
      order.country === "IN"
        ? "GST included"
        : "zero-rated export, no Indian tax",
    method:
      order.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "Card or wallet",
    market: `${currency}${order.country ? ` · ${order.country}` : ""}`,
    lines: lines || "  (no lines — this should not happen; look at the order)",
    adminUrl: `${appUrl()}/admin/orders/${order.number}`,
  };

  // One message each rather than one with several recipients: a bounce then
  // names the address that bounced, and one bad address in the list does not
  // take the others down with it.
  for (const inbox of inboxes) {
    await notify("admin.order", { orderId: order.id, email: inbox }, data);
  }
}

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
  await alertTheShop(orderId, "paid");

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

  const { bank } = (await getSiteConfig());

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
      // Only for the payment method that needs them. A card order that is
      // pending is pending on the provider, not on the customer.
      bankDetails:
        order.paymentMethod === "BANK_TRANSFER" && bank
          ? bankTransferLines(bank, order.number, order.currency).join("\n")
          : "",
      orderUrl: `${appUrl()}/account/orders/${order.number}`,
    },
  );

  await alertTheShop(orderId, "pending");
}
