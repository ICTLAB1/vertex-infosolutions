import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NOINDEX } from "@/lib/seo";
import { ProfileForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { channelStatus } from "@/lib/notify";

export const metadata: Metadata = { title: "Profile", ...NOINDEX };

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/account/profile");
  if (!user.emailVerifiedAt) redirect("/verify");

  const [sessions, recent] = await Promise.all([
    prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, userAgent: true },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        channel: true,
        status: true,
        template: true,
        destination: true,
        createdAt: true,
        error: true,
      },
    }),
  ]);

  const channels = channelStatus();

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6">
      <nav className="mb-3 text-[13px] text-muted">
        <Link href="/account" className="hover:text-link hover:underline">
          Your account
        </Link>
        <span className="px-1.5">›</span>
        <span className="text-ink">Profile</span>
      </nav>

      <h1 className="text-2xl font-bold text-ink">Profile &amp; notifications</h1>

      <section className="mt-4 rounded-lg border border-line bg-surface p-5">
        <ProfileForm
          name={user.name}
          phone={user.phone}
          whatsappOptIn={user.whatsappOptIn}
        />
        <p className="mt-4 border-t border-line-soft pt-3 text-[13px] text-muted">
          Your email address is{" "}
          <span className="font-semibold text-ink">{user.email}</span>, confirmed
          on {user.emailVerifiedAt?.toISOString().slice(0, 10)}. Changing it
          needs a new confirmation code — contact us and we will do it with you.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-[16px] font-bold text-ink">What we send you</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] text-muted">
          <li>
            <span className="font-semibold text-ink">Email</span> — order
            confirmations, licence details, invoices and renewal reminders. This is
            the record, and it cannot be turned off while you have orders.
          </li>
          <li>
            <span className="font-semibold text-ink">WhatsApp</span> — order
            confirmations only, and only if you opt in.{" "}
            <span className="text-ink">Never a licence</span>: one forwarded in a
            chat is somebody else&apos;s licence.
          </li>
          <li>No marketing on either channel. There is no list to be on.</li>
        </ul>
        {!channels.email || !channels.whatsapp ? (
          <p className="mt-3 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-warn">
            <span className="font-semibold">Development.</span> Not configured:{" "}
            {[!channels.email && "email", !channels.whatsapp && "WhatsApp"]
              .filter(Boolean)
              .join(", ")}
            . Messages are still recorded below so the flow can be checked.
          </p>
        ) : null}
      </section>

      {recent.length > 0 ? (
        <section className="mt-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-[16px] font-bold text-ink">Recent messages</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Everything we have tried to send you, and what happened to it.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <th scope="col" className="py-2 pr-3 font-medium">When</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Channel</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Message</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-b border-line-soft">
                    <td className="py-2 pr-3 text-muted">
                      {row.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-2 pr-3 text-ink">
                      {row.channel === "EMAIL" ? "Email" : "WhatsApp"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-muted">
                      {row.template}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.status === "SENT"
                            ? "bg-ok/10 text-ok"
                            : row.status === "SKIPPED"
                              ? "bg-ground text-muted"
                              : "bg-warn/10 text-warn"
                        }`}
                        title={row.error ?? undefined}
                      >
                        {row.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-[16px] font-bold text-ink">Signed-in devices</h2>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
          {sessions.map((session) => (
            <li key={session.id}>
              {session.createdAt.toISOString().slice(0, 10)} —{" "}
              <span className="text-ink">
                {session.userAgent?.slice(0, 70) ?? "unknown device"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-faint">
          Do not recognise one? Change your password and contact us.
        </p>
      </section>
    </div>
  );
}
