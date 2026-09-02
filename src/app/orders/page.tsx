import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Find your order" };

/**
 * Looking up an order without an account. The order number alone is not enough
 * — the email on the order has to match too, so a guessed number gets nowhere.
 */
async function findOrder(form: FormData) {
  "use server";

  const number = String(form.get("number") ?? "").trim().toUpperCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!number || !email) redirect("/orders?error=missing");

  const order = await prisma.order.findUnique({
    where: { number },
    select: { number: true, email: true },
  });

  // One outcome for both failures. Saying which half was wrong would turn this
  // form into a way of testing whether an order number exists.
  if (!order || order.email.toLowerCase() !== email) {
    redirect("/orders?error=notfound");
  }

  redirect(`/order/${order.number}`);
}

const MESSAGES: Record<string, string> = {
  missing: "Enter both the order number and the email address it was placed with.",
  notfound: "We could not find an order with that number and email address.",
};

export default async function OrdersPage(props: PageProps<"/orders">) {
  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const key = Array.isArray(params.error) ? params.error[0] : params.error;
  const message = key ? MESSAGES[key] : undefined;

  return (
    <div className="mx-auto max-w-[560px] px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-ink">Find your order</h1>
        <p className="mt-1 text-[14px] text-muted">
          Enter the order number from your confirmation email, along with the
          address it was sent to.
        </p>

        {message ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-deal/40 bg-deal/5 px-3 py-2 text-[14px] text-deal"
          >
            {message}
          </p>
        ) : null}

        <form action={findOrder} className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-[13px] font-semibold text-ink">
              Order number
            </span>
            <input
              name="number"
              placeholder="VX-2026-123456"
              required
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-[14px]"
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-semibold text-ink">
              Email address
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[14px]"
            />
          </label>
          <button
            type="submit"
            className="btn-amber w-full rounded-full py-2.5 text-[15px] font-semibold"
          >
            Find order
          </button>
        </form>

        <p className="mt-5 border-t border-line-soft pt-4 text-[13px] text-muted">
          Cannot find the email? Call us during working hours and we will look
          it up against your mobile number.
        </p>
      </div>
    </div>
  );
}
