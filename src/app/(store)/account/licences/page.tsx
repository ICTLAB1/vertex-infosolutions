import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NOINDEX } from "@/lib/seo";
import { Glyph } from "@/components/glyph";
import { getUser } from "@/lib/auth";
import { TERM_LABELS } from "@/lib/catalogue";
import { prisma } from "@/lib/db";
import { expiryLabel, expiryState } from "@/lib/renewals";

export const metadata: Metadata = {
  title: "Your licences",
  ...NOINDEX,
};

/**
 * The licence vault.
 *
 * This is what an account is *for*. A licence emailed once can be lost in a
 * mailbox; one here is findable in a year, when the renewal comes round and
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
      expiresAt: true,
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

  // Sorted by what needs attention rather than by purchase date: an expired
  // licence, then one expiring inside the reminder window, then the rest.
  const URGENCY = { expired: 0, expiring: 1, active: 2, perpetual: 3 };
  const now = new Date();
  issued.sort(
    (a, b) =>
      URGENCY[expiryState(a.expiresAt, now)] -
      URGENCY[expiryState(b.expiresAt, now)],
  );
  const soon = issued.filter((item) => {
    const state = expiryState(item.expiresAt, now);
    return state === "expiring" || state === "expired";
  });

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
        Every licensed product and subscription you have bought, kept
        permanently. What is shown below is the licence itself — treat it like
        a password.
      </p>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-lg font-semibold text-ink">No licences yet</p>
          <p className="mt-1 text-muted">
            Your licences appear here the moment an order is paid.
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
          {soon.length > 0 ? (
            <section className="mt-5 rounded-lg border border-warn/40 bg-warn/5 p-4">
              <h2 className="text-[15px] font-bold text-warn">
                {soon.length === 1
                  ? "One licence needs renewing"
                  : `${soon.length} licences need renewing`}
              </h2>
              <p className="mt-1 text-[13px] text-warn/90">
                Nothing here renews on its own and there is no card on file, so
                a licence you do not renew simply stops on its expiry date. We
                email you a month beforehand; this is the same list.
              </p>
            </section>
          ) : null}

          {waiting.length > 0 ? (
            <section className="mt-5 rounded-lg border border-warn/40 bg-warn/5 p-4">
              <h2 className="text-[15px] font-bold text-warn">
                Waiting on payment
              </h2>
              <p className="mt-1 text-[13px] text-warn/90">
                {waiting.length === 1 ? "One licence is" : `${waiting.length} licences are`}{" "}
                reserved against an order whose funds have not cleared. They are
                issued the moment the money lands.
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

                    <p className="mt-1.5">
                      <ExpiryTag expiresAt={item.expiresAt} now={now} />
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
        We keep these here for as long as you have an account, but keep your own
        copy too — of the licence and of the invoice. If you ever lose access to
        this account, the invoice is what lets the publisher confirm the licence
        is yours.
      </p>
    </div>
  );
}

/**
 * When a licence stops working, said plainly.
 *
 * The date is stored on the line at fulfilment rather than derived here, so a
 * licence sold under an older term keeps the dates it was actually sold under.
 * A line bought before expiry dates were recorded has none, and says so instead
 * of guessing one.
 */
function ExpiryTag({ expiresAt, now }: { expiresAt: Date | null; now: Date }) {
  if (!expiresAt) {
    return (
      <span className="rounded border border-line bg-ground/60 px-2 py-0.5 text-[12px] font-medium text-muted">
        Perpetual — no renewal
      </span>
    );
  }

  const state = expiryState(expiresAt, now);
  const tone =
    state === "expired"
      ? "border-deal/40 bg-deal/5 text-deal"
      : state === "expiring"
        ? "border-warn/40 bg-warn/10 text-warn"
        : "border-line bg-ground/60 text-muted";

  return (
    <span
      className={`rounded border px-2 py-0.5 text-[12px] font-medium ${tone}`}
    >
      {expiryLabel(expiresAt, now)}
    </span>
  );
}
