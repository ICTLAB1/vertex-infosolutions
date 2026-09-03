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
