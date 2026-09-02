"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { placeOrder, type CheckoutError } from "@/app/actions";
import { BILLING_COUNTRIES, type CurrencyCode } from "@/lib/market";
import { PAYMENT_METHOD_LABELS, paymentMethodNote } from "@/lib/types";
import type { PaymentMethod } from "@/generated/prisma/enums";

function SubmitButton({
  total,
  method,
}: {
  total: string;
  method: PaymentMethod;
}) {
  const { pending } = useFormStatus();
  const verb = method === "BANK_TRANSFER" ? "Place order for" : "Continue to pay";
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-amber w-full rounded-full py-3 text-[15px] font-semibold"
    >
      {pending
        ? method === "BANK_TRANSFER"
          ? "Placing your order…"
          : "Taking you to Stripe…"
        : `${verb} ${total}`}
    </button>
  );
}

export function CheckoutForm({
  methods,
  total,
  currency,
  domestic,
  account,
  simulated,
}: {
  methods: readonly PaymentMethod[];
  total: string;
  currency: CurrencyCode;
  domestic: boolean;
  account: { name: string; email: string; phone: string | null };
  /** True when no Stripe key is configured and payments are faked locally. */
  simulated: boolean;
}) {
  const [error, action] = useActionState<CheckoutError | null, FormData>(
    placeOrder,
    null,
  );
  const [method, setMethod] = useState<PaymentMethod>(methods[0]);
  const [country, setCountry] = useState(domestic ? "IN" : "");

  const invalid = (field: string) =>
    error?.field === field ? "border-deal ring-1 ring-deal" : "border-line";

  // The countries offered depend on the market, because the currency and the
  // billing country have to agree — an INR order billed to Germany would be an
  // export charged GST, which is simply wrong.
  const countries = domestic
    ? BILLING_COUNTRIES.filter((c) => c.code === "IN")
    : BILLING_COUNTRIES.filter((c) => c.code !== "IN");

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-deal/40 bg-deal/5 px-4 py-3 text-[14px] text-deal"
          >
            {error.message}
          </p>
        ) : null}

        <fieldset className="rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-[15px] font-bold text-ink">
            Where the keys go
          </legend>
          <p className="mt-1 text-[13px] text-muted">
            Nothing ships. Your licence keys are delivered into your account and
            emailed to the confirmed address on it.
          </p>
          <p className="mt-2 rounded-md border border-line bg-ground/50 px-3 py-2 text-[14px]">
            <span className="font-semibold text-ink">{account.name}</span>
            <span className="px-2 text-faint">·</span>
            <span className="text-ink">{account.email}</span>
            <span className="ml-2 text-[12px] font-semibold text-ok">
              verified
            </span>
          </p>
          <div className="mt-3">
            <Field
              label="Phone number"
              name="phone"
              type="tel"
              defaultValue={account.phone ?? ""}
              autoComplete="tel"
              placeholder={domestic ? "+91 98765 43210" : "+1 555 010 0000"}
              className={invalid("phone")}
              hint="With country code, in case we need to reach you about the order."
              required
            />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-[15px] font-bold text-ink">
            Invoice details
          </legend>
          <p className="mt-1 text-[13px] text-muted">
            {domestic
              ? "Your GST invoice is made out to these details."
              : "Your commercial invoice is made out to these details."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              name="billName"
              autoComplete="name"
              className={invalid("billName")}
              required
            />
            <Field
              label="Company (optional)"
              name="billCompany"
              autoComplete="organization"
              className={invalid("billCompany")}
            />
            <label className="block">
              <span className="block text-[13px] font-semibold text-ink">
                Billing country
              </span>
              <select
                name="billCountry"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px] ${invalid("billCountry")}`}
              >
                <option value="" disabled>
                  Choose a country
                </option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[12px] text-faint">
                {domestic
                  ? "INR pricing is for Indian billing. Switch to USD in the header to bill elsewhere."
                  : "For an Indian billing address, switch to ₹ INR in the header."}
              </span>
            </label>
            <Field
              label="City (optional)"
              name="billCity"
              autoComplete="address-level2"
              className={invalid("billCity")}
            />
            <Field
              label={domestic ? "State (optional)" : "State or region (optional)"}
              name="billRegion"
              autoComplete="address-level1"
              className={invalid("billRegion")}
            />
            <Field
              label="Postal code (optional)"
              name="billPostcode"
              autoComplete="postal-code"
              className={invalid("billPostcode")}
            />
          </div>

          {/* A registered Indian business can reclaim the GST as input credit,
              but only if its GSTIN is on the invoice — and it cannot be added
              afterwards. So it is asked for here, plainly, rather than buried. */}
          {domestic ? (
            <div className="mt-3 rounded-md border border-line bg-ground/50 p-3">
              <Field
                label="GSTIN (optional)"
                name="gstin"
                placeholder="29ABCDE1234F1Z5"
                className={invalid("gstin")}
                hint="Buying as a registered business? Give your GSTIN and it goes on the invoice, so you can claim the input tax credit. It cannot be added later."
              />
            </div>
          ) : null}
        </fieldset>

        <fieldset className="rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-[15px] font-bold text-ink">
            How would you like to pay?
          </legend>
          <div className="mt-2 space-y-2">
            {methods.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-ground/50 has-checked:border-brand has-checked:bg-brand/5"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option}
                  defaultChecked={option === methods[0]}
                  onChange={() => setMethod(option)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">
                    {PAYMENT_METHOD_LABELS[option]}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {paymentMethodNote(option, currency)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            {domestic
              ? "Charged in INR. UPI is usually instant."
              : `Charged in ${currency}. Your bank may apply its own foreign-exchange rate.`}
          </p>
          {simulated ? (
            <p className="mt-3 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-warn">
              <span className="font-semibold">Development only.</span> No Stripe
              key is configured, so paying online is simulated — no money moves
              and keys are issued immediately. This fallback refuses to run in
              production.
            </p>
          ) : null}
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="rounded-lg border border-line bg-surface p-4">
          <SubmitButton total={total} method={method} />
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            By placing this order you agree to the terms of sale. A licence key
            once revealed cannot be returned — before then, the order can be
            cancelled in full.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-faint">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M4 7V5a4 4 0 0 1 8 0v2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Payments are processed by Stripe. No card details reach this site.
          </p>
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  className = "",
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink">{label}</span>
      <input
        name={name}
        className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px] ${className}`}
        {...rest}
      />
      {hint ? (
        <span className="mt-1 block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}
