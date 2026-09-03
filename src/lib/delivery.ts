/**
 * What a buyer is promised at delivery, in one place.
 *
 * Two things were stated wrongly on every page that mentioned it, and both
 * matter before the money moves rather than after.
 *
 * A CSP subscription is not a key. Microsoft provisions a new tenant for the
 * order and the customer receives its sign-in details — there is nothing to
 * redeem, and somebody waiting for a code in their inbox is waiting for
 * something that will never arrive.
 *
 * And none of it is instant. Provisioning is done by a person, so the promise
 * is one business day. A shop that says "usually within a minute" and takes a
 * day has misled every customer it has, at the one moment they were deciding
 * whether to trust it.
 */

export const DELIVERY_WINDOW = "within one business day";

/** The bold part: what form delivery takes. */
export function deliveryHeadline(cspNewTenant: boolean): string {
  return cspNewTenant ? "Delivered to your account" : "Delivered by email";
}

/** The sentence after it. Starts lowercase; it follows a dash. */
export function deliverySummary(cspNewTenant: boolean): string {
  return cspNewTenant
    ? `we set up your new Microsoft tenant and send its sign-in details to your account and your email, ${DELIVERY_WINDOW} of payment.`
    : `the licence details are posted to your account and emailed to you, ${DELIVERY_WINDOW} of payment.`;
}

/** The one-line form, for a product card or a basket line. */
export function deliveryShort(cspNewTenant: boolean): string {
  return cspNewTenant
    ? `Tenant details ${DELIVERY_WINDOW}`
    : `Licence emailed ${DELIVERY_WINDOW}`;
}
