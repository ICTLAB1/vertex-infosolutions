import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm, RedirectMessageForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { CREDENTIAL_TEMPLATES, type NotifyTemplate } from "@/lib/notify";

import { abandonNotification, retryNotification } from "../admin-actions";

export const metadata: Metadata = { title: "Messages" };

const STATUSES = ["ABANDONED", "FAILED", "QUEUED", "SENT", "SKIPPED"] as const;

/**
 * The outbox, and the decisions only a person can make about it.
 *
 * Defaults to what went wrong rather than to everything: a list of thousands
 * of successful emails answers no question anybody has. `ABANDONED` is where
 * retrying stopped and somebody has to decide whether the address will ever
 * work; `FAILED` is still in the sweep's hands and shown next to it so the
 * difference is visible.
 *
 * Three decisions: try it again, give up on it, or — for the commonest cause,
 * a typo in an address — send it somewhere corrected. The third is not offered
 * on a message carrying a licence key or a one-time code, because "send this
 * credential to an address of my choosing" is not a support tool.
 */
export default async function MessagesPage(props: PageProps<"/admin/messages">) {
  await requireAdmin("/admin/messages");
  const params = (await props.searchParams) as Record<string, string | undefined>;
  const status = STATUSES.find((s) => s === params.status);

  const where = status
    ? { status }
    : { status: { in: ["ABANDONED" as const, "FAILED" as const] } };

  const [messages, counts] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        channel: true,
        template: true,
        destination: true,
        subject: true,
        status: true,
        attempts: true,
        error: true,
      },
    }),
    prisma.notification.groupBy({ by: ["status"], _count: true }),
  ]);

  const count = (s: string) =>
    counts.find((row) => row.status === s)?._count ?? 0;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Messages</h1>
      <p className="mt-1 text-[14px] text-muted">
        Every email and WhatsApp the shop has tried to send. Showing{" "}
        {status ? status.toLowerCase() : "what needs attention"}.
      </p>

      <nav className="mt-3 flex flex-wrap gap-2 text-[13px]">
        <Link
          href="/admin/messages"
          className={`rounded-md border px-3 py-1.5 ${
            status ? "border-line bg-surface" : "border-ink bg-ink text-white"
          }`}
        >
          Needs attention ({count("ABANDONED") + count("FAILED")})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/messages?status=${s}`}
            className={`rounded-md border px-3 py-1.5 ${
              status === s ? "border-ink bg-ink text-white" : "border-line bg-surface"
            }`}
          >
            {s[0] + s.slice(1).toLowerCase()} ({count(s)})
          </Link>
        ))}
      </nav>

      {messages.length === 0 ? (
        <p className="mt-6 rounded-lg border border-line bg-surface p-6 text-center text-muted">
          Nothing here. {status ? "" : "Nothing has failed, which is the point."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">
                  <span className="font-mono text-[13px]">{message.template}</span>{" "}
                  <span className="text-[13px] font-normal text-muted">
                    → {message.destination} · {message.channel.toLowerCase()}
                  </span>
                </p>
                <p className="text-[13px] text-muted">
                  {message.createdAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  {message.attempts} attempt{message.attempts === 1 ? "" : "s"} ·{" "}
                  <span
                    className={
                      message.status === "SENT" ? "text-ok" : "font-semibold text-deal"
                    }
                  >
                    {message.status}
                  </span>
                </p>
              </div>
              {message.subject ? (
                <p className="mt-1 text-[13px] text-muted">{message.subject}</p>
              ) : null}
              {message.error ? (
                <p className="mt-1 rounded border border-deal/30 bg-deal/5 px-2 py-1 font-mono text-[12px] text-deal">
                  {message.error}
                </p>
              ) : null}

              {message.status !== "SENT" ? (
                <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-4">
                  <ActionForm
                    action={retryNotification}
                    fields={{ notificationId: message.id }}
                    label="Try again"
                    busy="Queueing…"
                  />
                  {message.status !== "ABANDONED" ? (
                    <ActionForm
                      action={abandonNotification}
                      fields={{ notificationId: message.id }}
                      label="Give up on it"
                      busy="Stopping…"
                      tone="loud"
                    />
                  ) : null}
                  {/* Offered only where it is allowed. A message carrying a
                      licence key or a one-time code goes to the address on the
                      account and nowhere else, so the field is absent rather
                      than present and always refused. */}
                  {CREDENTIAL_TEMPLATES.includes(
                    message.template as NotifyTemplate,
                  ) ? (
                    <p className="max-w-sm text-[12px] text-muted">
                      This one carries a licence key or a one-time code, so it
                      can only go to the address on the account. If that address
                      is wrong, the customer has to change it.
                    </p>
                  ) : (
                    <RedirectMessageForm
                      notificationId={message.id}
                      channel={message.channel}
                      destination={message.destination}
                    />
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
