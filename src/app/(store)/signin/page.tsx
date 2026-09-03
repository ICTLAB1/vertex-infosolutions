import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage(props: PageProps<"/signin">) {
  const user = await getUser();
  if (user) redirect(user.emailVerifiedAt ? "/account" : "/verify");

  const params = (await props.searchParams) as Record<
    string,
    string | string[] | undefined
  >;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only ever a path on this site. An absolute URL here would make the sign-in
  // page an open redirect, which is a phisher's favourite thing to find.
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return (
    <div className="mx-auto max-w-[440px] px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-ink">Sign in</h1>
        <p className="mt-1 mb-4 text-[14px] text-muted">
          Your licence keys, invoices and renewal dates are in your account.
        </p>
        <SignInForm next={next} />
      </div>
    </div>
  );
}
