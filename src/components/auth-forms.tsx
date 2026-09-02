"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  confirmEmail,
  register,
  resendCode,
  signIn,
  updateProfile,
  type AuthError,
} from "@/app/auth-actions";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-amber w-full rounded-full py-2.5 text-[15px] font-semibold"
    >
      {pending ? busy : label}
    </button>
  );
}

function Problem({ error }: { error: AuthError }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-deal/40 bg-deal/5 px-3 py-2 text-[14px] text-deal"
    >
      {error.message}
    </p>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  error: AuthError;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const bad = error?.field === name;
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink">{label}</span>
      <input
        name={name}
        aria-invalid={bad || undefined}
        className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px] ${
          bad ? "border-deal ring-1 ring-deal" : "border-line"
        }`}
        {...rest}
      />
      {hint ? (
        <span className="mt-1 block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function RegisterForm() {
  const [error, action] = useActionState<AuthError, FormData>(register, null);

  return (
    <form action={action} className="space-y-3">
      <Problem error={error} />
      <Field label="Your name" name="name" autoComplete="name" error={error} required />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        error={error}
        hint="We send a code here to confirm it. Licence keys and invoices go to this address."
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={error}
        hint="At least 12 characters. A short phrase you can remember is ideal."
        required
      />
      <Field
        label="Phone number (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+91 98765 43210"
        error={error}
        hint="International format, with the country code."
      />
      <label className="flex items-start gap-2.5 rounded-md border border-line bg-ground/40 p-3">
        <input type="checkbox" name="whatsappOptIn" className="mt-0.5" />
        <span className="text-[13px] text-muted">
          <span className="font-semibold text-ink">
            Send order updates on WhatsApp.
          </span>{" "}
          Order confirmations only — never licence keys, and never marketing.
          You can turn this off at any time in your account.
        </span>
      </label>
      <Submit label="Create account" busy="Creating your account…" />
      <p className="text-center text-[13px] text-muted">
        Already have one?{" "}
        <Link href="/signin" className="text-link underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [error, action] = useActionState<AuthError, FormData>(signIn, null);

  return (
    <form action={action} className="space-y-3">
      <Problem error={error} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        error={error}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={error}
        required
      />
      <Submit label="Sign in" busy="Signing in…" />
      <p className="text-center text-[13px] text-muted">
        New here?{" "}
        <Link href="/register" className="text-link underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function VerifyForm() {
  const [error, action] = useActionState<AuthError, FormData>(
    confirmEmail,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <Problem error={error} />
      <label className="block">
        <span className="block text-[13px] font-semibold text-ink">
          Six-digit code
        </span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          required
          className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-center font-mono text-[22px] tracking-[0.4em] ${
            error ? "border-deal ring-1 ring-deal" : "border-line"
          }`}
        />
      </label>
      <Submit label="Confirm email" busy="Checking…" />
    </form>
  );
}

export function ProfileForm({
  name,
  phone,
  whatsappOptIn,
}: {
  name: string;
  phone: string | null;
  whatsappOptIn: boolean;
}) {
  const [error, action] = useActionState<AuthError, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      {error ? (
        <p
          role="status"
          className={`rounded-md border px-3 py-2 text-[14px] ${
            error.message === "Saved."
              ? "border-ok/40 bg-ok/5 text-ok"
              : "border-deal/40 bg-deal/5 text-deal"
          }`}
        >
          {error.message}
        </p>
      ) : null}
      <Field
        label="Your name"
        name="name"
        defaultValue={name}
        autoComplete="name"
        error={error}
        required
      />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        defaultValue={phone ?? ""}
        autoComplete="tel"
        placeholder="+91 98765 43210"
        error={error}
        hint="International format, with the country code. Leave blank to remove it."
      />
      <label className="flex items-start gap-2.5 rounded-md border border-line bg-ground/40 p-3">
        <input
          type="checkbox"
          name="whatsappOptIn"
          defaultChecked={whatsappOptIn}
          className="mt-0.5"
        />
        <span className="text-[13px] text-muted">
          <span className="font-semibold text-ink">
            Send order updates on WhatsApp.
          </span>{" "}
          Order confirmations only — never licence keys.
        </span>
      </label>
      <Submit label="Save changes" busy="Saving…" />
    </form>
  );
}


export function ResendForm() {
  const [state, action] = useActionState<AuthError, FormData>(
    async () => resendCode(),
    null,
  );

  return (
    <form action={action}>
      {state ? (
        <p role="status" className="mb-2 text-[13px] text-ok">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="text-[13px] text-link hover:underline">
        Send another code
      </button>
      <p className="mt-1 text-[12px] text-faint">
        Check the spam folder first — an email carrying a six-digit code is a
        shape that filters dislike.
      </p>
    </form>
  );
}
