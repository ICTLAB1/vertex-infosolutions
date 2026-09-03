import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { confirmCheckoutSession } from "@/app/actions";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false },
};

/**
 * Where Stripe sends the customer back to.
 *
 * The webhook is the authority — it arrives whether or not this browser
 * survives the redirect — but waiting for it would leave somebody staring at
 * "pending" seconds after they paid. So this confirms too, and `fulfilOrder`
 * makes whichever arrives second a no-op.
 *
 * The `session_id` in the URL is attacker-supplied and worth nothing on its
 * own; `confirmCheckoutSession` asks Stripe what it actually says before
 * anything is issued.
 */
export default async function CheckoutReturnPage(
  props: PageProps<"/checkout/return">,
) {
  const user = await getUser();
  if (!user) redirect("/signin");

  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const raw = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id;

  if (!raw) redirect("/account/orders");

  const result = await confirmCheckoutSession(raw);

  if ("orderNumber" in result) {
    redirect(`/account/orders/${result.orderNumber}`);
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-12">
      <div className="rounded-lg border border-warn/40 bg-warn/5 p-6">
        <h1 className="text-xl font-bold text-warn">
          We could not confirm that payment
        </h1>
        <p className="mt-2 text-[14px] text-ink">{result.error}</p>
        <p className="mt-3 text-[14px] text-muted">
          If money has left your account, nothing is lost — the payment is
          recorded with Stripe and your order will complete on its own within a
          few minutes. Check your orders, and contact us if it has not.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/account/orders"
            className="btn-amber rounded-full px-5 py-2 text-[14px] font-semibold"
          >
            Your orders
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-line bg-surface px-5 py-2 text-[14px] font-semibold text-ink"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
