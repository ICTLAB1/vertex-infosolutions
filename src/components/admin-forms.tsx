"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  markPaymentReceived,
  resendKeys,
  resendPaymentInstructions,
  updatePrice,
  type AdminResult,
} from "@/app/admin/admin-actions";

function Outcome({ result }: { result: AdminResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`rounded-md border px-3 py-2 text-[13px] ${
        result.ok
          ? "border-ok/40 bg-ok/5 text-ok"
          : "border-deal/40 bg-deal/5 text-deal"
      }`}
    >
      {result.message}
    </p>
  );
}

function Go({
  label,
  busy,
  tone = "quiet",
}: {
  label: string;
  busy: string;
  tone?: "quiet" | "loud";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        tone === "loud"
          ? "btn-amber rounded-full px-4 py-2 text-[14px] font-semibold disabled:opacity-60"
          : "rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-link hover:bg-ground/60 disabled:opacity-60"
      }
    >
      {pending ? busy : label}
    </button>
  );
}

/**
 * Marking a bank transfer received.
 *
 * The reference is required rather than optional. It is the only thing that
 * ties this click to a line on a bank statement, and the question "why is this
 * order paid?" is asked months later by somebody reconciling accounts.
 */
export function MarkPaidForm({ number }: { number: string }) {
  const [result, action] = useActionState<AdminResult, FormData>(
    markPaymentReceived,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <Outcome result={result} />
      <input type="hidden" name="number" value={number} />
      <label className="block">
        <span className="block text-[13px] font-semibold text-ink">
          Bank reference
        </span>
        <input
          name="reference"
          required
          placeholder="UTR / wire reference from the statement"
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[14px]"
        />
        <span className="mt-1 block text-[12px] text-faint">
          Recorded against this order. Issuing keys sends the customer their
          confirmation and their licence keys, so do this once the funds have
          actually cleared.
        </span>
      </label>
      <Go label="Mark paid and issue keys" busy="Issuing…" tone="loud" />
    </form>
  );
}

export function ResendKeysForm({ number, email }: { number: string; email: string }) {
  const [result, action] = useActionState<AdminResult, FormData>(resendKeys, null);

  return (
    <form action={action} className="space-y-2">
      <Outcome result={result} />
      <input type="hidden" name="number" value={number} />
      <Go label="Send the keys again" busy="Sending…" />
      <p className="text-[12px] text-faint">
        Goes to {email}, the address on the order. Changing where it goes means
        changing the account.
      </p>
    </form>
  );
}

export function ResendPendingForm({ number }: { number: string }) {
  const [result, action] = useActionState<AdminResult, FormData>(
    resendPaymentInstructions,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <Outcome result={result} />
      <input type="hidden" name="number" value={number} />
      <Go label="Send the payment details again" busy="Sending…" />
    </form>
  );
}

/**
 * One row of the price book.
 *
 * Both figures are typed in the currency's major unit, which is how a price
 * book is written. A price above its own list price is refused by the action
 * rather than rendered as a negative saving.
 */
export function PriceForm({
  priceId,
  currency,
  price,
  list,
}: {
  priceId: string;
  currency: string;
  price: string;
  list: string;
}) {
  const [result, action] = useActionState<AdminResult, FormData>(updatePrice, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="priceId" value={priceId} />
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
          {currency} price
        </span>
        <input
          name="price"
          defaultValue={price}
          inputMode="decimal"
          className="mt-0.5 w-28 rounded-md border border-line bg-white px-2 py-1 text-right font-mono text-[13px] tabular-nums"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
          List
        </span>
        <input
          name="list"
          defaultValue={list}
          inputMode="decimal"
          className="mt-0.5 w-28 rounded-md border border-line bg-white px-2 py-1 text-right font-mono text-[13px] tabular-nums"
        />
      </label>
      <Go label="Save" busy="Saving…" />
      {result ? (
        <span
          role="status"
          className={`text-[12px] ${result.ok ? "text-ok" : "text-deal"}`}
        >
          {result.message}
        </span>
      ) : null}
    </form>
  );
}

/**
 * A one-field action with a confirmation beneath it.
 *
 * Every remaining admin control is the same shape: a hidden identifier, a
 * button, and a sentence saying what happened. Writing each one separately
 * produced four copies of the same twenty lines, and the copies drifted.
 */
export function ActionForm({
  action,
  fields,
  label,
  busy,
  tone = "quiet",
  note,
}: {
  action: (previous: AdminResult, form: FormData) => Promise<AdminResult>;
  fields: Record<string, string>;
  label: string;
  busy: string;
  tone?: "quiet" | "loud";
  note?: string;
}) {
  const [result, run] = useActionState<AdminResult, FormData>(action, null);
  return (
    <form action={run} className="space-y-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Go label={label} busy={busy} tone={tone} />
      {note ? <p className="text-[12px] text-muted">{note}</p> : null}
      <Outcome result={result} />
    </form>
  );
}
