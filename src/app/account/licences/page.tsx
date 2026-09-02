import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Glyph } from "@/components/glyph";
import { getUser } from "@/lib/auth";
import { TERM_LABELS } from "@/lib/catalogue";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Your licences",
  robots: { index: false },
};

/**
 * The licence vault.
 *
 * This is what an account is *for*. A key emailed once can be lost in a
 * mailbox; a key here is findable in a year, when the renewal comes round and
 * somebody has to prove what the company owns.
 */
export default async function LicencesPage() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/account/licences");
  if (!user.emailVerifiedAt) redirect("/verify");

  const items = await prisma.orderItem.findMany({
    where: { order: { userId: user.id } },
    orderBy: { order: { createdAt: "desc" } },
    select: {
      id: true,
      name: true,
      variantName: true,
      seats: true,
      qty: true,
      licenceKey: true,
      order: {
        select: { number: true, createdAt: true, paymentStatus: true },
      },
      variant: {
        select: {
          product: {
            select: {
              slug: true,
              glyph: true,
              term: true,
              brand: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const issued = items.filter((item) => item.licenceKey);
  const waiting = items.filter((item) => !item.licenceKey);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <nav className="mb-3 text-[13px] text-muted">
        <Link href="/account" className="hover:text-link hover:underline">
          Your account
        </Link>
        <span className="px-1.5">›</span>
        <span className="text-ink">Your licences</span>
      </nav>

      <h1 className="text-2xl font-bold text-ink">Your licences</h1>
      <p className="mt-1 text-[14px] text-muted">
        Every key you have bought, kept permanently. A licence key is the
        licence — treat it like a password.
      </p>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-lg font-semibold text-ink">No licences yet</p>
          <p className="mt-1 text-muted">
            Keys appear here the moment an order is paid.
          </p>
          <Link
            href="/s"
            className="btn-amber mt-4 inline-block rounded-full px-5 py-2 font-semibold"
          >
            Browse the catalogue
          </Link>
        </div>
      ) : (
        <>
          {waiting.length > 0 ? (
            <section className="mt-5 rounded-lg border border-warn/40 bg-warn/5 p-4">
              <h2 className="text-[15px] font-bold text-warn">
                Waiting on payment
              </h2>
              <p className="mt-1 text-[13px] text-warn/90">
                {waiting.length === 1 ? "One licence is" : `${waiting.length} licences are`}{" "}
                reserved against an order whose funds have not cleared. Keys are
                issued the moment they do.
              </p>
              <ul className="mt-2 text-[13px] text-warn/90">
                {waiting.map((item) => (
                  <li key={item.id}>
                    {item.name} — order{" "}
                    <Link
                      href={`/account/orders/${item.order.number}`}
                      className="font-mono underline"
                    >
                      {item.order.number}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ul className="mt-5 space-y-3">
            {issued.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-line bg-surface p-4"
              >
                <div className="flex gap-4">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-ground/60 text-nav-2">
                    <Glyph
                      name={item.variant?.product.glyph ?? "licence"}
                      className="h-10 w-10"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                      {item.variant?.product.brand.name}
                    </p>
                    {item.variant ? (
                      <Link
                        href={`/product/${item.variant.product.slug}`}
                        className="text-[16px] font-semibold text-ink hover:text-link hover:underline"
                      >
                        {item.name}
                      </Link>
                    ) : (
                      <span className="text-[16px] font-semibold text-ink">
                        {item.name}
                      </span>
                    )}
                    <p className="text-[13px] text-muted">
                      {item.variantName}
                      {item.seats > 1
                        ? ` · ${item.seats * item.qty} seats`
                        : ""}
                      {item.variant
                        ? ` · ${TERM_LABELS[item.variant.product.term]}`
                        : ""}
                    </p>

                    <p className="mt-2 inline-block rounded border border-line bg-ground/60 px-3 py-1.5 font-mono text-[15px] font-medium text-ink">
                      {item.licenceKey}
                    </p>

                    <p className="mt-1.5 text-[12px] text-faint">
                      Order{" "}
                      <Link
                        href={`/account/orders/${item.order.number}`}
                        className="font-mono text-link hover:underline"
                      >
                        {item.order.number}
                      </Link>{" "}
                      · {item.order.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 rounded-lg border border-line bg-surface p-4 text-[13px] text-muted">
        <span className="font-semibold text-ink">A note on keeping these.</span>{" "}
        We keep your keys here for as long as you have an account, but keep your
        own copy too — of the key and of the invoice. If you ever lose access to
        this account, the invoice is what lets the publisher confirm the licence
        is yours.
      </p>
    </div>
  );
}
