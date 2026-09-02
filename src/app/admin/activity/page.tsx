import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Activity" };

/**
 * What the store did, and what it failed to do.
 *
 * Two lists that answer two different questions. The failures answer "did the
 * customer actually get their keys?", which is the one worth checking daily —
 * nothing retries a failed send yet, so a message here is a message that never
 * arrived. The changes-by-hand list answers "who did this, and when?", asked
 * once, in an argument.
 */
export default async function AdminActivityPage() {
  await requireAdmin("/admin/activity");

  const [failed, actions, skipped] = await Promise.all([
    prisma.notification.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { status: "SKIPPED" } }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">Activity</h1>

      <section className="mt-5 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[16px] font-bold text-ink">Messages that failed</h2>
        <p className="mt-1 text-[13px] text-muted">
          Nothing retries these. A failed licence-key email means a customer has
          paid and has nothing — the fastest fix is the order page, which can
          send the keys again.
        </p>
        {failed.length === 0 ? (
          <p className="mt-3 text-[14px] text-ok">
            Nothing has failed. {skipped > 0 ? `${skipped} WhatsApp messages were skipped for want of an opt-in, which is not a failure.` : ""}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft text-[13px]">
            {failed.map((message) => (
              <li key={message.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[12px] text-faint tabular-nums">
                    {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="font-semibold text-ink">{message.template}</span>
                  <span className="text-muted">
                    {message.channel.toLowerCase()} → {message.destination}
                  </span>
                  {message.orderId ? (
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(message.destination)}`}
                      className="text-link hover:underline"
                    >
                      find the order
                    </Link>
                  ) : null}
                </div>
                <p className="text-deal">{message.error}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[16px] font-bold text-ink">Changed by hand</h2>
        <p className="mt-1 text-[13px] text-muted">
          Every payment recorded, key re-sent and price changed by a person.
        </p>
        {actions.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft text-[13px]">
            {actions.map((entry) => (
              <li key={entry.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[12px] text-faint tabular-nums">
                    {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="font-semibold text-ink">{entry.actorEmail}</span>
                  <span className="rounded bg-ground/70 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                    {entry.action}
                  </span>
                  {entry.action.startsWith("order.") ? (
                    <Link
                      href={`/admin/orders/${entry.subject}`}
                      className="font-mono text-link hover:underline"
                    >
                      {entry.subject}
                    </Link>
                  ) : (
                    <span className="font-mono text-muted">{entry.subject}</span>
                  )}
                </div>
                <p className="text-muted">{entry.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
