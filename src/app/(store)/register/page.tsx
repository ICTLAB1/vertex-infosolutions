import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create a Vertex Infosolutions account. Licence keys are delivered into it and stay there.",
};

export default async function RegisterPage() {
  const user = await getUser();
  if (user) redirect(user.emailVerifiedAt ? "/account" : "/verify");

  return (
    <div className="mx-auto max-w-[440px] px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 mb-4 text-[14px] text-muted">
          Every licence you buy is delivered into your account and stays there —
          keys, invoices and renewal dates in one place, so nothing depends on
          finding an old email.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
