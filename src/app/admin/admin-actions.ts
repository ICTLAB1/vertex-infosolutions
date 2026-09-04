"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { recordAdminAction, requireAdmin } from "@/lib/admin";
import { TERM_LABELS } from "@/lib/catalogue";
import type { LicenceTerm } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { CurrencyCode } from "@/lib/market";
import { formatMoneyExact, MAX_MINOR, parseMoneyMinor } from "@/lib/money";
import { notifyPending, fulfilOrder, sendKeys } from "@/lib/orders";
import { looksLikeEmail } from "@/lib/enquiries";
import { pingIndexNow } from "@/lib/indexnow";
import { CREDENTIAL_TEMPLATES, type NotifyTemplate } from "@/lib/notify";

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
    include: {
      variant: { include: { product: { select: { name: true, slug: true } } } },
    },
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
  // And tell the search engines, after this page has already gone back to the
  // administrator — a price shown in a search result is worth correcting
  // quickly, and none of it is worth making them wait for.
  after(() => pingIndexNow([`/product/${existing.variant.product.slug}`]));
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
  // A withdrawn listing is submitted too, and deliberately: it is how a search
  // engine finds out the page is gone, instead of going on offering it for
  // weeks and sending customers to a 404.
  after(() => pingIndexNow([`/product/${product.slug}`, "/s"]));
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

/**
 * Point an abandoned message at a corrected address, and try again.
 *
 * The case this exists for is a typo: somebody registered as
 * "name@gmial.com", the confirmation bounced six times and the sweep gave up,
 * and until now the only way out was for a customer who never got the email to
 * fix their own account.
 *
 * It refuses to redirect anything that carries a credential. A licence key or
 * a one-time code sent to an address of an administrator's choosing is the
 * whole of an attack, not a convenience — those go to the address on the
 * account, and changing that is the customer's to do. The message is
 * requeued rather than sent from here, so the back-off that stops us
 * hammering a refusing mailbox still applies.
 *
 * The address on the account is deliberately left alone: this fixes one
 * message, and a correction that silently rewrote where every future message
 * goes would be a bigger change than the button says.
 */
export async function redirectNotification(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/messages");
  const id = str(form, "notificationId");
  const to = str(form, "destination");

  const message = await prisma.notification.findUnique({
    where: { id },
    select: { destination: true, template: true, channel: true, status: true },
  });
  if (!message) return { ok: false, message: "No such message." };
  if (message.status === "SENT") {
    return { ok: false, message: "That one already sent — nothing to redirect." };
  }
  if (CREDENTIAL_TEMPLATES.includes(message.template as NotifyTemplate)) {
    return {
      ok: false,
      message:
        "That message carries a licence key or a one-time code, so it can only go to the address on the account. The customer has to change it themselves.",
    };
  }
  if (!to) return { ok: false, message: "Enter the corrected address." };
  if (to === message.destination) {
    return { ok: false, message: "That is the address it already failed on." };
  }

  if (message.channel === "EMAIL") {
    if (!looksLikeEmail(to)) {
      return { ok: false, message: "That does not look like an email address." };
    }
  } else if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(to)) {
    return { ok: false, message: "That does not look like a phone number." };
  }

  await prisma.notification.update({
    where: { id },
    data: {
      destination: message.channel === "EMAIL" ? to.toLowerCase() : to,
      status: "FAILED",
      attempts: 0,
      lastAttemptAt: null,
      error: null,
    },
  });
  await recordAdminAction(
    admin,
    "message.redirect",
    to,
    `${message.template} redirected from ${message.destination} and queued again.`,
  );

  revalidatePath("/admin/messages");
  return {
    ok: true,
    message: "Redirected and queued. The next sweep will try it.",
  };
}

// ---------------------------------------------------------------------------
// Editing the catalogue itself
//
// Everything above this line edits a number or flips a flag. What follows can
// change what a listing says, add one, and remove one — so each action below
// validates before it writes, refuses rather than guesses, and records what it
// did. Three rules run through all of them.
//
// A listing that has ever been sold is never deleted. An order line copies the
// name, the SKU and the price it was sold at, but an invoice is explained by
// the listing behind it, and a catalogue that quietly loses the products in
// last year's accounts is a catalogue that cannot be audited. Withdrawing is
// the answer, and it is one click away.
//
// A slug is an address. Changing one is allowed, because a typo in a URL is
// worth fixing, but the form says plainly that the old address stops working
// and a search engine has to find the new one.
//
// Money is checked the same way it is checked in `updatePrice`: both figures
// present, price at or below list, and inside what a 32-bit column can hold.
// ---------------------------------------------------------------------------

/** A checkbox, which arrives as "on" or not at all. */
function flag(form: FormData, key: string): boolean {
  return form.get(key) !== null;
}

function num(form: FormData, key: string): number | null {
  const raw = str(form, key);
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * A URL segment, from whatever was typed.
 *
 * Normalised rather than rejected: somebody pasting "Microsoft 365 E3" into
 * the field means the obvious thing, and refusing it teaches them nothing.
 */
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** One bullet per line. Blank lines are spacing, not empty bullets. */
function toLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * The specification table, typed as "Label: value" a line at a time.
 *
 * Order is kept, because the table is read top to bottom and "Term" belongs
 * above "Delivery". A line with no colon is not a spec row and is dropped
 * rather than stored under an empty label.
 */
function toSpecs(input: string): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const line of toLines(input)) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    const label = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (label && value) specs[label] = value;
  }
  return specs;
}

/**
 * Everything a listing says about itself.
 *
 * One form and one save. The alternative — a save button per field — was
 * tried on paper and is worse: a listing is edited as a whole, and half-saved
 * copy is how a page ends up with a new name and the old description.
 */
export async function saveProductDetails(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const id = str(form, "productId");

  const name = str(form, "name");
  const summary = str(form, "summary");
  if (name.length < 2) return { ok: false, message: "A listing needs a name." };
  if (summary.length < 10) {
    return {
      ok: false,
      message:
        "The summary is the sentence under the title, on the page and in Google. Write one.",
    };
  }

  const slug = toSlug(str(form, "slug") || name);
  if (slug.length < 2) {
    return { ok: false, message: "That name leaves nothing to build an address from." };
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { name: true, slug: true },
  });
  if (!existing) return { ok: false, message: "No such listing." };

  if (slug !== existing.slug) {
    const clash = await prisma.product.findUnique({
      where: { slug },
      select: { name: true },
    });
    if (clash) {
      return {
        ok: false,
        message: `That address is already ${clash.name}. Two listings cannot share one.`,
      };
    }
  }

  const brandId = str(form, "brandId");
  const categoryId = str(form, "categoryId");
  const [brand, category] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }),
    prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } }),
  ]);
  if (!brand) return { ok: false, message: "Pick a publisher." };
  if (!category) return { ok: false, message: "Pick a shelf." };

  const term = str(form, "term");
  if (!(term in TERM_LABELS)) {
    return { ok: false, message: "Pick a licence term." };
  }

  const logo = str(form, "logo");
  if (logo && !logo.startsWith("/")) {
    return {
      ok: false,
      message:
        "A picture is a path inside this site, like /logos/adobe/photoshop.svg. Leave it empty for the drawn placeholder.",
    };
  }

  await prisma.product.update({
    where: { id },
    data: {
      name,
      slug,
      summary,
      bullets: toLines(str(form, "bullets")),
      specs: toSpecs(str(form, "specs")),
      brandId,
      categoryId,
      term: term as LicenceTerm,
      logo: logo || null,
      cspNewTenant: flag(form, "cspNewTenant"),
      featured: flag(form, "featured"),
    },
  });

  await recordAdminAction(
    admin,
    "product.edit",
    slug,
    `${existing.name} edited` +
      (slug !== existing.slug ? `, address moved from /${existing.slug} to /${slug}` : "") +
      (name !== existing.name ? `, renamed to ${name}` : "") +
      ".",
  );

  revalidatePath("/admin/catalogue");
  revalidatePath(`/product/${slug}`);
  if (slug !== existing.slug) revalidatePath(`/product/${existing.slug}`);
  revalidatePath("/", "layout");
  after(() => pingIndexNow([`/product/${slug}`]));

  return {
    ok: true,
    message:
      slug !== existing.slug
        ? `Saved. The listing now lives at /product/${slug}; the old address will show "not found".`
        : "Saved.",
  };
}

/**
 * A new listing.
 *
 * Created withdrawn, always. A product needs a price before it can be sold and
 * copy before it should be read, and neither exists at the moment the form is
 * submitted — so it is made, and then put on sale deliberately once it is
 * finished. The alternative is a half-written listing appearing in the shop
 * between two clicks.
 *
 * It comes with its first variant, because a product with no variant has no
 * SKU, no price and nothing to buy; making the two separate steps only means
 * the catalogue can hold something that cannot exist.
 */
export async function createProduct(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");

  const name = str(form, "name");
  const summary = str(form, "summary");
  const sku = str(form, "sku").toUpperCase();
  if (name.length < 2) return { ok: false, message: "A listing needs a name." };
  if (summary.length < 10) {
    return { ok: false, message: "Write the sentence that goes under the title." };
  }
  if (!/^[A-Z0-9][A-Z0-9._:-]{2,}$/.test(sku)) {
    return {
      ok: false,
      message:
        "The SKU is ours, not the publisher's: letters, digits and - . : _ , at least three characters. MS-… and ADBE-… are the pattern already in use.",
    };
  }

  const slug = toSlug(str(form, "slug") || name);
  const [clash, skuClash, brand, category] = await Promise.all([
    prisma.product.findUnique({ where: { slug }, select: { name: true } }),
    prisma.variant.findUnique({ where: { sku }, select: { id: true } }),
    prisma.brand.findUnique({ where: { id: str(form, "brandId") }, select: { id: true } }),
    prisma.category.findUnique({ where: { id: str(form, "categoryId") }, select: { id: true } }),
  ]);
  if (clash) {
    return { ok: false, message: `That address is already ${clash.name}.` };
  }
  if (skuClash) return { ok: false, message: `${sku} is already in use.` };
  if (!brand) return { ok: false, message: "Pick a publisher." };
  if (!category) return { ok: false, message: "Pick a shelf." };

  const term = str(form, "term");
  if (!(term in TERM_LABELS)) return { ok: false, message: "Pick a licence term." };

  const seats = num(form, "seats") ?? 1;
  if (seats < 1) return { ok: false, message: "A variant covers at least one seat." };

  const product = await prisma.product.create({
    data: {
      slug,
      name,
      summary,
      brandId: brand.id,
      categoryId: category.id,
      term: term as LicenceTerm,
      published: false,
      quoteOnly: flag(form, "quoteOnly"),
      variants: {
        create: {
          sku,
          partNumber: str(form, "partNumber") || null,
          name: str(form, "variantName") || "1 licence, 1 year",
          seats,
        },
      },
    },
    select: { id: true },
  });

  await recordAdminAction(
    admin,
    "product.create",
    slug,
    `${name} created, withdrawn, with SKU ${sku}.`,
  );

  revalidatePath("/admin/catalogue");
  redirect(`/admin/catalogue/${product.id}`);
}

/**
 * Removing a listing for good.
 *
 * Refused the moment anything has been sold against it. The order keeps its
 * own copy of the name and the price, so nothing on an invoice would break —
 * but the listing is what explains the invoice, and a catalogue that loses the
 * products in last year's accounts cannot be audited. Withdrawing does
 * everything deleting was wanted for and keeps the record.
 *
 * The name has to be typed to confirm. Not ceremony: this is the one control
 * in the back office whose result cannot be undone, and it sits on the same
 * page as the buttons that can.
 */
export async function deleteProduct(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const id = str(form, "productId");

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      name: true,
      slug: true,
      variants: { select: { id: true, _count: { select: { orderItems: true } } } },
    },
  });
  if (!product) return { ok: false, message: "No such listing." };

  if (str(form, "confirm") !== product.name) {
    return {
      ok: false,
      message: `Type the listing's name exactly — ${product.name} — to confirm. Nothing was deleted.`,
    };
  }

  const sold = product.variants.reduce((n, v) => n + v._count.orderItems, 0);
  if (sold > 0) {
    return {
      ok: false,
      message: `${product.name} has been sold ${sold} ${sold === 1 ? "time" : "times"}, so it cannot be deleted — the orders would no longer be explainable. Withdraw it instead: it disappears from the shop and keeps its history.`,
    };
  }

  await prisma.product.delete({ where: { id } });
  await recordAdminAction(
    admin,
    "product.delete",
    product.slug,
    `${product.name} deleted. It had never been sold.`,
  );

  revalidatePath("/admin/catalogue");
  revalidatePath("/", "layout");
  redirect("/admin/catalogue?deleted=1");
}

/**
 * A variant: one buyable line under a listing.
 *
 * Handles both adding and editing, because the fields and every rule about
 * them are identical and two copies would drift. A `variantId` means edit; a
 * `productId` alone means add.
 */
export async function saveVariant(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const variantId = str(form, "variantId");
  const productId = str(form, "productId");

  const sku = str(form, "sku").toUpperCase();
  const name = str(form, "name");
  const seats = num(form, "seats");
  const partNumber = str(form, "partNumber") || null;

  if (!/^[A-Z0-9][A-Z0-9._:-]{2,}$/.test(sku)) {
    return { ok: false, message: "The SKU needs at least three characters: letters, digits and - . : _" };
  }
  if (name.length < 2) {
    return { ok: false, message: 'Say what this line is — "1 licence, 1 year".' };
  }
  if (seats === null || seats < 1 || seats > 100_000) {
    return { ok: false, message: "Seats is a whole number, at least one." };
  }

  const clash = await prisma.variant.findUnique({
    where: { sku },
    select: { id: true, product: { select: { name: true } } },
  });
  if (clash && clash.id !== variantId) {
    return { ok: false, message: `${sku} already belongs to ${clash.product.name}.` };
  }

  if (variantId) {
    const before = await prisma.variant.findUnique({
      where: { id: variantId },
      select: { sku: true, product: { select: { slug: true, name: true } } },
    });
    if (!before) return { ok: false, message: "No such variant." };

    await prisma.variant.update({
      where: { id: variantId },
      data: { sku, partNumber, name, seats },
    });
    await recordAdminAction(
      admin,
      "variant.edit",
      sku,
      `${before.product.name}: ${name}, ${seats} ${seats === 1 ? "seat" : "seats"}` +
        (before.sku !== sku ? `, SKU changed from ${before.sku}` : "") +
        ".",
    );
    revalidatePath("/admin/catalogue");
    revalidatePath(`/product/${before.product.slug}`);
    return { ok: true, message: "Saved." };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, name: true },
  });
  if (!product) return { ok: false, message: "No such listing." };

  await prisma.variant.create({
    data: { productId: product.id, sku, partNumber, name, seats },
  });
  await recordAdminAction(
    admin,
    "variant.create",
    sku,
    `${product.name}: ${name} added. It has no price yet, so it is not on sale in either market.`,
  );
  revalidatePath("/admin/catalogue");
  revalidatePath(`/product/${product.slug}`);
  return {
    ok: true,
    message: "Added. Give it a price in each market before it can be bought.",
  };
}

/** Removing a variant, on the same terms as removing a listing. */
export async function deleteVariant(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const variantId = str(form, "variantId");

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: {
      sku: true,
      name: true,
      product: { select: { id: true, slug: true, name: true, _count: { select: { variants: true } } } },
      _count: { select: { orderItems: true, cartItems: true } },
    },
  });
  if (!variant) return { ok: false, message: "No such variant." };

  if (variant._count.orderItems > 0) {
    return {
      ok: false,
      message: `${variant.sku} has been sold ${variant._count.orderItems} ${variant._count.orderItems === 1 ? "time" : "times"} and cannot be removed. Take the whole listing off sale instead, or leave this line unpriced so it is not offered.`,
    };
  }
  if (variant.product._count.variants <= 1) {
    return {
      ok: false,
      message: "This is the only thing the listing sells. Withdraw the listing instead of emptying it.",
    };
  }

  await prisma.variant.delete({ where: { id: variantId } });
  await recordAdminAction(
    admin,
    "variant.delete",
    variant.sku,
    `${variant.product.name}: ${variant.name} removed. It had never been sold.`,
  );
  revalidatePath("/admin/catalogue");
  revalidatePath(`/product/${variant.product.slug}`);
  return { ok: true, message: `${variant.sku} removed.` };
}

/**
 * Giving a variant a price in a market it was not sold in.
 *
 * The counterpart to `updatePrice`, which can only change a row that exists.
 * A variant with no row in a currency is invisible to that whole market —
 * silently — and until now the only cure was a reseed. This is that cure, one
 * SKU at a time.
 */
export async function setVariantPrice(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const variantId = str(form, "variantId");
  const currency = str(form, "currency").toUpperCase();

  if (currency !== "INR" && currency !== "USD") {
    return { ok: false, message: "The shop prices in INR and USD." };
  }

  const price = parseMoneyMinor(str(form, "price"));
  const list = parseMoneyMinor(str(form, "list") || str(form, "price"));
  if (price === null || list === null) {
    return { ok: false, message: "Enter the amount as a plain number, like 9200 or 9200.50." };
  }
  if (price <= 0) return { ok: false, message: "A price of zero is not a price." };
  if (price > list) {
    return { ok: false, message: "The price cannot be above the list price — the saving would be negative." };
  }
  if (list > MAX_MINOR) {
    return {
      ok: false,
      message: `That is above the largest amount this shop can record, ${formatMoneyExact(MAX_MINOR, currency as CurrencyCode)}. A sale that large is a quote, not a basket.`,
    };
  }

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { sku: true, product: { select: { slug: true, name: true, quoteOnly: true } } },
  });
  if (!variant) return { ok: false, message: "No such variant." };
  if (variant.product.quoteOnly) {
    return {
      ok: false,
      message: `${variant.product.name} is quoted per order, so it holds no prices. Turn that off first and the ordinary buying path takes over.`,
    };
  }

  await prisma.price.upsert({
    where: { variantId_currency: { variantId, currency } },
    create: { variantId, currency, priceMinor: price, listMinor: list },
    update: { priceMinor: price, listMinor: list },
  });

  await recordAdminAction(
    admin,
    "price.set",
    variant.sku,
    `${variant.product.name}, ${currency}: ${formatMoneyExact(price, currency as CurrencyCode)}.`,
  );

  revalidatePath("/admin/catalogue");
  revalidatePath("/", "layout");
  after(() => pingIndexNow([`/product/${variant.product.slug}`]));
  return { ok: true, message: `${variant.sku} is now on sale in ${currency}.` };
}

/**
 * Taking a variant out of one market.
 *
 * Deliberately separate from setting a price, and worth naming for what it is:
 * removing the row stops the SKU being sold in that currency entirely. It is
 * how a publisher's withdrawal from one market is recorded without touching
 * the other.
 */
export async function clearVariantPrice(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const priceId = str(form, "priceId");

  const price = await prisma.price.findUnique({
    where: { id: priceId },
    select: {
      currency: true,
      variant: { select: { sku: true, product: { select: { slug: true, name: true } } } },
    },
  });
  if (!price) return { ok: false, message: "No such price." };

  await prisma.price.delete({ where: { id: priceId } });
  await recordAdminAction(
    admin,
    "price.clear",
    price.variant.sku,
    `${price.variant.product.name}: no longer sold in ${price.currency}.`,
  );
  revalidatePath("/admin/catalogue");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${price.variant.sku} is no longer sold in ${price.currency}.`,
  };
}

/**
 * Moving a listing between "buy it" and "ask us".
 *
 * A quote-only listing holds no price at all — that is what makes it safe.
 * There is no figure for a page to render by accident and none for a basket
 * to charge, which is exactly why Autodesk is sold this way while its price
 * book is missing. So turning it on has to remove the prices, and the form
 * says how many and asks first: this is the one flag whose side effect is
 * deleting data.
 *
 * Turning it off does nothing but clear the flag. The listing then has no
 * price in either market and is simply not sold until somebody gives it one,
 * which the catalogue page shows in red.
 */
export async function setQuoteOnly(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const id = str(form, "productId");
  const quoteOnly = str(form, "quoteOnly") === "true";

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      name: true,
      slug: true,
      quoteOnly: true,
      variants: { select: { _count: { select: { prices: true } } } },
    },
  });
  if (!product) return { ok: false, message: "No such listing." };
  if (product.quoteOnly === quoteOnly) return { ok: true, message: "Nothing changed." };

  const prices = product.variants.reduce((n, v) => n + v._count.prices, 0);

  if (quoteOnly && prices > 0 && !flag(form, "confirmPrices")) {
    return {
      ok: false,
      message: `${product.name} has ${prices} ${prices === 1 ? "price" : "prices"}. A quoted listing holds none, so they would be deleted — tick the box to confirm, or nothing is changed.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    if (quoteOnly) {
      await tx.price.deleteMany({ where: { variant: { productId: id } } });
    }
    await tx.product.update({ where: { id }, data: { quoteOnly } });
  });

  await recordAdminAction(
    admin,
    quoteOnly ? "product.quote-only" : "product.priced",
    product.slug,
    quoteOnly
      ? `${product.name} is now quoted per order. ${prices} ${prices === 1 ? "price was" : "prices were"} removed.`
      : `${product.name} is back on the ordinary buying path and needs prices.`,
  );

  revalidatePath("/admin/catalogue");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: quoteOnly
      ? `${product.name} is now quoted per order.`
      : `${product.name} needs a price in each market before anyone can buy it.`,
  };
}

/**
 * The same change to many listings at once.
 *
 * The catalogue runs to five hundred lines, and "withdraw everything Autodesk
 * until the price book arrives" was previously five hundred clicks or a
 * reseed. Only publish and withdraw are offered in bulk, and on purpose:
 * both are reversible, and a bulk edit that could rename or reprice is a bulk
 * edit that eventually does so by accident.
 */
export async function bulkSetPublished(
  _previous: AdminResult,
  form: FormData,
): Promise<AdminResult> {
  const admin = await requireAdmin("/admin/catalogue");
  const published = str(form, "published") === "true";
  const ids = form
    .getAll("productIds")
    .filter((value): value is string => typeof value === "string");

  if (ids.length === 0) {
    return { ok: false, message: "Tick the listings first — nothing was selected." };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, published: true },
  });
  const changing = products.filter((p) => p.published !== published);
  if (changing.length === 0) {
    return {
      ok: true,
      message: `All ${products.length} were already ${published ? "on sale" : "withdrawn"}.`,
    };
  }

  await prisma.product.updateMany({
    where: { id: { in: changing.map((p) => p.id) } },
    data: { published },
  });

  await recordAdminAction(
    admin,
    published ? "product.publish.bulk" : "product.withdraw.bulk",
    `${changing.length} listings`,
    `${published ? "Put back on sale" : "Withdrawn"}: ${changing
      .slice(0, 12)
      .map((p) => p.name)
      .join(", ")}${changing.length > 12 ? `, and ${changing.length - 12} more` : ""}.`,
  );

  revalidatePath("/admin/catalogue");
  revalidatePath("/", "layout");
  after(() => pingIndexNow(changing.slice(0, 50).map((p) => `/product/${p.slug}`)));

  return {
    ok: true,
    message: `${changing.length} ${changing.length === 1 ? "listing is" : "listings are"} now ${published ? "on sale" : "withdrawn"}. Existing orders are untouched.`,
  };
}
