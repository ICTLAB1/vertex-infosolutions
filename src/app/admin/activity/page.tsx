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

  const [abandoned, retrying, actions, skipped] = await Promise.all([
    prisma.notification.findMany({
      where: { status: "ABANDONED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.findMany({
      where: { status: { in: ["FAILED", "QUEUED"] } },
      orderBy: { lastAttemptAt: "desc" },
      take: 20,
    }),
    prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { status: "SKIPPED" } }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">Activity</h1>

      <section className="mt-5 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[16px] font-bold text-ink">Messages given up on</h2>
        <p className="mt-1 text-[13px] text-muted">
          The sweep tried these and stopped — either the provider refused the
          address outright, or the attempts ran out. Nothing will try again on
          its own. An abandoned licence-key email means a customer has paid and
          has nothing: open the order and send the licence again, to a corrected
          address if that was the problem.
        </p>
        {abandoned.length === 0 ? (
          <p className="mt-3 text-[14px] text-ok">
            Nothing has been given up on. {skipped > 0 ? `${skipped} WhatsApp messages were skipped for want of an opt-in, which is not a failure.` : ""}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft text-[13px]">
            {abandoned.map((message) => (
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

      {retrying.length > 0 ? (
        <section className="mt-4 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-[16px] font-bold text-ink">Still being retried</h2>
          <p className="mt-1 text-[13px] text-muted">
            These failed and are waiting their turn. Each attempt waits longer
            than the last, so nothing here needs doing unless it is still here
            tomorrow.
          </p>
          <ul className="mt-3 divide-y divide-line-soft text-[13px]">
            {retrying.map((message) => (
              <li key={message.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <span className="font-mono text-[12px] text-faint tabular-nums">
                  {(message.lastAttemptAt ?? message.createdAt)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}
                </span>
                <span className="font-semibold text-ink">{message.template}</span>
                <span className="text-muted">
                  {message.channel.toLowerCase()} → {message.destination}
                </span>
                <span className="text-warn">
                  attempt {message.attempts}
                  {message.error ? `: ${message.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
