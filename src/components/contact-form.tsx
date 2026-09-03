"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitEnquiry, type EnquiryResult } from "@/app/contact-actions";

const KINDS = [
  { value: "GENERAL", label: "General enquiry" },
  { value: "VOLUME_QUOTE", label: "Volume quote — 10 seats or more" },
  { value: "LICENSING", label: "Licensing question before I buy" },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-amber rounded-full px-5 py-2.5 text-[15px] font-semibold disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send it"}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue = "",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink">
        {label}
        {required ? "" : <span className="font-normal text-faint"> (optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px]"
      />
    </label>
  );
}

/**
 * The form behind every "ask us" on the site.
 *
 * Typed values come back on a rejection, because React empties an uncontrolled
 * form once a server action returns and retyping a paragraph is how somebody
 * decides not to bother.
 */
export function ContactForm({
  defaultKind = "GENERAL",
  productSlug,
}: {
  defaultKind?: string;
  productSlug?: string;
}) {
  const [result, run] = useActionState<EnquiryResult, FormData>(
    submitEnquiry,
    null,
  );
  const kept = result && !result.ok ? (result.values ?? {}) : {};

  if (result?.ok) {
    return (
      <div
        role="status"
        className="rounded-lg border border-ok/40 bg-ok/5 p-5 text-[15px] text-ink"
      >
        <p className="font-bold text-ok">Sent.</p>
        <p className="mt-1">{result.message}</p>
      </div>
    );
  }

  return (
    <form action={run} className="space-y-3">
      {productSlug ? (
        <input type="hidden" name="productSlug" value={productSlug} />
      ) : null}

      {/* The honeypot. Hidden from people and from screen readers, left where
          a form-filling script will find it. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block">
        <span className="block text-[13px] font-semibold text-ink">
          What is this about?
        </span>
        <select
          name="kind"
          defaultValue={kept.kind ?? defaultKind}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px]"
        >
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name" name="name" required defaultValue={kept.name ?? ""} />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          defaultValue={kept.email ?? ""}
        />
        <Field label="Company" name="company" defaultValue={kept.company ?? ""} />
        <Field label="Phone" name="phone" defaultValue={kept.phone ?? ""} />
      </div>

      <label className="block">
        <span className="block text-[13px] font-semibold text-ink">
          What do you need?
        </span>
        <textarea
          name="message"
          required
          rows={5}
          defaultValue={kept.message ?? ""}
          placeholder="Which product, how many seats, and anything about your existing setup we should know."
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px]"
        />
      </label>

      {result && !result.ok ? (
        <p
          role="alert"
          className="rounded-md border border-deal/40 bg-deal/5 px-3 py-2 text-[13px] text-deal"
        >
          {result.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Submit />
        <p className="text-[12px] text-muted">
          We answer within one business day. Your details are used to answer
          you and nothing else.
        </p>
      </div>
    </form>
  );
}
