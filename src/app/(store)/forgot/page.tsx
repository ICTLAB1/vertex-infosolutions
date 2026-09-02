import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ForgotForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Forgotten password",
  robots: { index: false },
};

export default async function ForgotPage(props: PageProps<"/forgot">) {
  const user = await getUser();
  if (user) redirect("/account");

  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;

  return (
    <div className="mx-auto max-w-[440px] px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-ink">Forgotten password</h1>
        <p className="mt-1 mb-4 text-[14px] text-muted">
          Tell us the address on the account and we will send a six-digit code
          to it. The code lets you choose a new password; until you do, your
          current one still works.
        </p>
        <ForgotForm email={raw} />
      </div>

      <p className="mt-4 text-center text-[13px] text-muted">
        Locked out of the mailbox itself?{" "}
        <Link href="/contact" className="text-link underline">
          Talk to us
        </Link>{" "}
        — your licence keys are not lost, but proving the account is yours takes
        a person.
      </p>
    </div>
  );
}
