"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAdminAction, requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoneyExact, parseMoneyMinor } from "@/lib/money";
import { notifyPending, fulfilOrder, sendKeys } from "@/lib/orders";

/**
 * The handful of things a person still has to do.
 *
 * Everything here is guarded by `requireAdmin` on its own, not by the layout
 * around the pages: a layout does not run before a server action, so a guard
 * that lived only there would protect what an administrator can see and
 * nothing they can do. Each one also writes an `AdminAction` row, because
 * these are the changes somebody will later need explained.
 */

export type AdminResult = { ok: boolean; message: string } | null;

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Mark a bank transfer received.
 *
 * The one place money enters the store without Stripe saying so. It goes
 * through `fulfilOrder`, the same conditional claim the webhook uses, so an
 * administrator clicking twice — or clicking at the moment a payment arrives
 * by another route — issues one set of keys and sends one email, not two.
 */
export async function markPaymentReceived(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin();
  const number = str(form, "number");
  const reference = str(form, "reference");

  if (!reference) {
    return {
      ok: false,
      message: "Enter the bank reference. Without it this cannot be reconciled later.",
    };
  }

  const order = await prisma.order.findUnique({ where: { number } });
  if (!order) return { ok: false, message: "No such order." };
  if (order.paymentStatus === "PAID") {
    return { ok: false, message: "That order is already paid." };
  }

  const result = await fulfilOrder(order.id);
  if (!result.fulfilled) {
    return {
      ok: false,
      message: result.alreadyDone
        ? "Nothing to do — the payment had already been recorded."
        : "The order could not be fulfilled. Check the server log.",
    };
  }

  await recordAdminAction(
    admin,
    "order.mark-paid",
    number,
    `Marked paid on a bank transfer, reference "${reference}", for ${formatMoneyExact(order.totalMinor, order.currency as CurrencyCode)}. Keys issued and emailed.`,
  );

  revalidatePath("/admin/orders");
  // A redirect rather than a returned message. Recording the payment changes
  // what the page shows — the form that was just used is replaced by the
  // resend panel — so the component holding the result unmounts and takes the
  // confirmation with it. The first run of this looked, to the administrator,
  // exactly like nothing happening.
  redirect(`/admin/orders/${number}?recorded=1`);
}

/** Send the licence keys again, to the address on the order. */
export async function resendKeys(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin();
  const number = str(form, "number");

  const order = await prisma.order.findUnique({ where: { number } });
  if (!order) return { ok: false, message: "No such order." };

  const sent = await sendKeys(order.id);
  if (!sent) {
    return {
      ok: false,
      message: "That order has no keys yet, so there is nothing to send.",
    };
  }

  await recordAdminAction(
    admin,
    "order.resend-keys",
    number,
    `Licence keys sent again to ${order.email}.`,
  );

  revalidatePath(`/admin/orders/${number}`);
  return { ok: true, message: `Keys sent again to ${order.email}.` };
}

/** Send the bank details again for an order still awaiting a transfer. */
export async function resendPaymentInstructions(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin();
  const number = str(form, "number");

  const order = await prisma.order.findUnique({ where: { number } });
  if (!order) return { ok: false, message: "No such order." };
  if (order.paymentStatus === "PAID") {
    return { ok: false, message: "That order is paid; there is nothing to chase." };
  }

  await notifyPending(order.id);
  await recordAdminAction(
    admin,
    "order.resend-pending",
    number,
    `Payment instructions sent again to ${order.email}.`,
  );

  revalidatePath(`/admin/orders/${number}`);
  return { ok: true, message: `Payment instructions sent again to ${order.email}.` };
}

/**
 * Change a price.
 *
 * Both figures are entered in the currency's major unit and stored as minor,
 * because a price book is written in rupees and dollars, not paise and cents.
 * A price above its own list price would render a negative discount, so it is
 * refused rather than shown.
 *
 * Existing orders are untouched: they copied what they were sold at, which is
 * the whole reason they copy it.
 */
export async function updatePrice(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const priceId = str(form, "priceId");

  const price = parseMoneyMinor(str(form, "price"));
  const list = parseMoneyMinor(str(form, "list"));

  if (price === null || list === null) {
    return { ok: false, message: "Enter both amounts as plain numbers, like 9200 or 9200.50." };
  }
  if (price <= 0) return { ok: false, message: "A price of zero is not a price." };
  if (price > list) {
    return {
      ok: false,
      message: "The price cannot be above the list price — the saving would be negative.",
    };
  }

  const existing = await prisma.price.findUnique({
    where: { id: priceId },
    include: { variant: { include: { product: { select: { name: true } } } } },
  });
  if (!existing) return { ok: false, message: "No such price." };

  if (existing.priceMinor === price && existing.listMinor === list) {
    return { ok: true, message: "Nothing changed." };
  }

  await prisma.price.update({
    where: { id: priceId },
    data: { priceMinor: price, listMinor: list },
  });

  const currency = existing.currency as CurrencyCode;
  await recordAdminAction(
    admin,
    "price.update",
    existing.variant.sku,
    `${existing.variant.product.name} (${existing.variant.name}), ${currency}: ` +
      `price ${formatMoneyExact(existing.priceMinor, currency)} to ${formatMoneyExact(price, currency)}, ` +
      `list ${formatMoneyExact(existing.listMinor, currency)} to ${formatMoneyExact(list, currency)}.`,
  );

  // The storefront reads prices on every render, so the pages that show this
  // one have to be re-rendered rather than served from the cache.
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Saved. ${existing.variant.sku} is now ${formatMoneyExact(price, currency)}.`,
  };
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/**
 * Take a listing down, or put it back.
 *
 * Not a delete. A withdrawn product keeps its slug, its orders and its order
 * lines — an invoice from last month has to stay explainable — it simply stops
 * being shown, searchable or in the sitemap. This is the honest answer to a
 * price that turned out to be wrong: hide it until it is right, rather than
 * sell at it or destroy the record.
 */
export async function setProductPublished(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const id = str(form, "productId");
  const published = str(form, "published") === "true";

  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true, slug: true, published: true },
  });
  if (!product) return { ok: false, message: "No such product." };
  if (product.published === published) {
    return { ok: true, message: "Nothing changed." };
  }

  await prisma.product.update({ where: { id }, data: { published } });
  await recordAdminAction(admin, published ? "product.publish" : "product.withdraw", product.slug, `${product.name} is now ${published ? "on sale" : "withdrawn from the shop"}.`);

  revalidatePath("/admin/catalogue");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: published
      ? `${product.name} is back on sale.`
      : `${product.name} is withdrawn. Existing orders are untouched.`,
  };
}

/** Whether a product appears on the home page. */
export async function setProductFeatured(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const id = str(form, "productId");
  const featured = str(form, "featured") === "true";

  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true, slug: true, featured: true },
  });
  if (!product) return { ok: false, message: "No such product." };
  if (product.featured === featured) return { ok: true, message: "Nothing changed." };

  await prisma.product.update({ where: { id }, data: { featured } });
  await recordAdminAction(admin, featured ? "product.feature" : "product.unfeature", product.slug, `${product.name} ${featured ? "added to" : "removed from"} the home page.`);

  revalidatePath("/admin/catalogue");
  revalidatePath("/");
  return { ok: true, message: featured ? "Featured." : "No longer featured." };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * Confirm an address by hand.
 *
 * The escape hatch for the case the OTP cannot solve: a customer whose code
 * will not arrive because their mail provider is refusing us, or a colleague
 * set up before email worked at all. It is recorded loudly, because it is the
 * one place a person overrides the check that stops licences being delivered
 * to an address nobody reads.
 */
export async function verifyCustomerEmail(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/customers");
  const id = str(form, "userId");

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!user) return { ok: false, message: "No such customer." };
  if (user.emailVerifiedAt) {
    return { ok: true, message: "That address was already confirmed." };
  }

  await prisma.user.update({
    where: { id },
    data: { emailVerifiedAt: new Date() },
  });
  await recordAdminAction(admin, "customer.verify-email", user.email, "Address confirmed by an administrator rather than by a one-time code.");

  revalidatePath(`/admin/customers/${id}`);
  return { ok: true, message: `${user.email} can now buy.` };
}

/**
 * End every session a customer has.
 *
 * For the call that starts "I think somebody else is in my account". Sessions
 * are rows, so revoking them is a delete rather than a flag somebody has to
 * remember to check — the next request from that browser is signed out.
 */
export async function signOutCustomer(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/customers");
  const id = str(form, "userId");

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });
  if (!user) return { ok: false, message: "No such customer." };

  const { count } = await prisma.session.deleteMany({ where: { userId: id } });
  await recordAdminAction(admin, "customer.sign-out-all", user.email, `${count} session${count === 1 ? "" : "s"} ended by an administrator.`);

  revalidatePath(`/admin/customers/${id}`);
  return {
    ok: true,
    message:
      count === 0
        ? "They had no active sessions."
        : `Ended ${count} session${count === 1 ? "" : "s"}. They will have to sign in again.`,
  };
}

// ---------------------------------------------------------------------------
// The outbox
// ---------------------------------------------------------------------------

/**
 * Put an abandoned message back in the queue.
 *
 * The sweep gives up after six attempts, which is right for a mailbox that is
 * full and wrong for a provider that was down for an afternoon. This resets
 * the count so the next sweep tries again — it does not send anything itself,
 * because sending from a click would bypass the back-off that stops us
 * hammering an address that keeps refusing.
 */
export async function retryNotification(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/messages");
  const id = str(form, "notificationId");

  const message = await prisma.notification.findUnique({
    where: { id },
    select: { destination: true, template: true, status: true },
  });
  if (!message) return { ok: false, message: "No such message." };
  if (message.status === "SENT") {
    return { ok: true, message: "That one already sent." };
  }

  await prisma.notification.update({
    where: { id },
    data: { status: "FAILED", attempts: 0, lastAttemptAt: null, error: null },
  });
  await recordAdminAction(admin, "message.retry", message.destination, `${message.template} queued again by an administrator.`);

  revalidatePath("/admin/messages");
  return {
    ok: true,
    message: "Queued. The next sweep will try it — within fifteen minutes.",
  };
}

/** Stop trying. For an address that will never accept mail. */
export async function abandonNotification(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/messages");
  const id = str(form, "notificationId");

  const message = await prisma.notification.findUnique({
    where: { id },
    select: { destination: true, template: true },
  });
  if (!message) return { ok: false, message: "No such message." };

  await prisma.notification.update({
    where: { id },
    data: { status: "ABANDONED" },
  });
  await recordAdminAction(admin, "message.abandon", message.destination, `${message.template} given up on by an administrator.`);

  revalidatePath("/admin/messages");
  return { ok: true, message: "Given up on. Nothing will try it again." };
}

/**
 * Close an enquiry.
 *
 * The note is the point, not the flag. Six weeks later the question is never
 * "was this handled?" — the timestamp answers that — it is "what did we tell
 * them?", and the only place that answer exists is whatever the person who
 * replied wrote here.
 */
export async function markEnquiryHandled(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/enquiries");
  const id = str(form, "enquiryId");
  const note = str(form, "note");

  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    select: { email: true, kind: true, handledAt: true },
  });
  if (!enquiry) return { ok: false, message: "No such enquiry." };
  if (enquiry.handledAt) {
    return { ok: true, message: "Somebody had already dealt with that one." };
  }

  await prisma.enquiry.update({
    where: { id },
    data: {
      handledAt: new Date(),
      handledBy: admin.email,
      handledNote: note.slice(0, 2000) || null,
    },
  });
  await recordAdminAction(
    admin,
    "enquiry.handled",
    enquiry.email,
    note ? `${enquiry.kind} closed: ${note}` : `${enquiry.kind} closed with no note.`,
  );

  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Closed." };
}

/** Put one back on the pile, for an answer that turned out not to be one. */
export async function reopenEnquiry(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/enquiries");
  const id = str(form, "enquiryId");

  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    select: { email: true },
  });
  if (!enquiry) return { ok: false, message: "No such enquiry." };

  await prisma.enquiry.update({
    where: { id },
    data: { handledAt: null, handledBy: null, handledNote: null },
  });
  await recordAdminAction(
    admin,
    "enquiry.reopen",
    enquiry.email,
    "Reopened by an administrator.",
  );

  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Back on the open list." };
}
