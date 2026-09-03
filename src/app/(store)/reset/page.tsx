import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NOINDEX } from "@/lib/seo";
import { ResendResetForm, ResetForm } from "@/components/auth-forms";
import { getUser, normaliseEmail, OTP_TTL_TEXT } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { channelStatus } from "@/lib/notify";

export const metadata: Metadata = {
  title: "Choose a new password",
  ...NOINDEX,
};

export default async function ResetPage(props: PageProps<"/reset">) {
  const user = await getUser();
  if (user) redirect("/account/profile");

  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;
  const email = normaliseEmail(raw ?? "");

  const channels = channelStatus();

  // The same development-only escape hatch as /verify: with no mail provider
  // the code would be unreachable and the flow untestable. It is an account
  // enumeration oracle, which is exactly why it is fenced behind *both* an
  // unconfigured provider and a non-production build, and why it can never
  // run on the deployed site.
  let devCode: string | null = null;
  if (email && !channels.email && process.env.NODE_ENV !== "production") {
    const row = await prisma.notification.findFirst({
      where: { destination: email, template: "otp.reset" },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    devCode = row?.body.match(/\b(\d{6})\b/)?.[1] ?? null;
  }

  return (
    <div className="mx-auto max-w-[460px] px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
        <p className="mt-1 text-[14px] text-muted">
          If{" "}
          <span className="font-semibold text-ink">
            {email || "that address"}
          </span>{" "}
          has an account, a six-digit code is on its way to it. It expires in{" "}
          {OTP_TTL_TEXT}.
        </p>
        <p className="mt-2 mb-4 text-[13px] text-muted">
          Setting a new password signs out every device that was signed in,
          including this one — you will be signed back in here straight away.
        </p>

        {devCode ? (
          <p className="mb-4 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-warn">
            <span className="font-semibold">Development only.</span> No mail
            provider is configured, so the code is shown here rather than
            emailed: <span className="font-mono text-[15px]">{devCode}</span>
          </p>
        ) : null}

        <ResetForm email={email} />

        <div className="mt-4 border-t border-line-soft pt-4">
          <ResendResetForm email={email} />
        </div>
      </div>

      <p className="mt-4 text-center text-[13px] text-muted">
        Wrong address?{" "}
        <Link href="/forgot" className="text-link underline">
          Start again
        </Link>
      </p>
    </div>
  );
}
