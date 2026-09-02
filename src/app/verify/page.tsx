import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResendForm, VerifyForm } from "@/components/auth-forms";
import { getUser, OTP_TTL_TEXT } from "@/lib/auth";
import { channelStatus } from "@/lib/notify";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false },
};

export default async function VerifyPage() {
  const user = await getUser();
  if (!user) redirect("/signin");
  if (user.emailVerifiedAt) redirect("/account");

  const channels = channelStatus();

  // In development there is usually no mail provider, so the code would be
  // unreachable and the whole flow untestable. Rather than weaken the check,
  // the most recent code is surfaced here — and only here, only when email is
  // genuinely not configured, and never in production.
  let devCode: string | null = null;
  if (!channels.email && process.env.NODE_ENV !== "production") {
    const row = await prisma.notification.findFirst({
      where: { userId: user.id, template: "otp.verify" },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    devCode = row?.body.match(/\b(\d{6})\b/)?.[1] ?? null;
  }

  return (
    <div className="mx-auto max-w-[460px] px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-ink">Confirm your email</h1>
        <p className="mt-1 text-[14px] text-muted">
          We sent a six-digit code to{" "}
          <span className="font-semibold text-ink">{user.email}</span>. It
          expires in {OTP_TTL_TEXT}.
        </p>
        <p className="mt-2 mb-4 text-[13px] text-muted">
          This is the address your licence keys and invoices go to, so it has to
          be one you can actually read. Nothing can be bought until it is
          confirmed.
        </p>

        {devCode ? (
          <p className="mb-4 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-warn">
            <span className="font-semibold">Development only.</span> No mail
            provider is configured, so the code is shown here rather than
            emailed: <span className="font-mono text-[15px]">{devCode}</span>
          </p>
        ) : null}

        <VerifyForm />

        <div className="mt-4 border-t border-line-soft pt-4">
          <ResendForm />
        </div>
      </div>
    </div>
  );
}
