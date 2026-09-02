"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { placeOrder, type CheckoutError } from "@/app/actions";
import { COUNTRIES } from "@/lib/shipping";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_NOTES,
} from "@/lib/types";
import type { PaymentMethod } from "@/generated/prisma/enums";

function SubmitButton({ total, method }: { total: string; method: PaymentMethod }) {
  const { pending } = useFormStatus();
  const verb = method === "BANK_TRANSFER" ? "Place order for" : "Pay";
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-amber w-full rounded-full py-3 text-[15px] font-semibold"
    >
      {pending ? "Placing your order…" : `${verb} ${total}`}
    </button>
  );
}

export function CheckoutForm({
  needsAddress,
  methods,
  total,
  defaultCountry,
}: {
  needsAddress: boolean;
  methods: readonly PaymentMethod[];
  total: string;
  defaultCountry: string | null;
}) {
  const [error, action] = useActionState<CheckoutError | null, FormData>(
    placeOrder,
    null,
  );
  const [method, setMethod] = useState<PaymentMethod>(methods[0]);

  const invalid = (field: string) =>
    error?.field === field ? "border-deal ring-1 ring-deal" : "border-line";

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
            Where should the invoice go?
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              className={invalid("email")}
              hint="Invoice, shipping updates and any licence keys go here."
              required
            />
            <Field
              label="Phone number"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 010 0000"
              className={invalid("phone")}
              hint="With country code. Used by the courier for delivery and customs."
              required
            />
          </div>
        </fieldset>

        {needsAddress ? (
          <fieldset className="rounded-lg border border-line bg-surface p-4">
            <legend className="px-1 text-[15px] font-bold text-ink">
              Delivery address
            </legend>
            <p className="mt-1 text-[13px] text-muted">
              Needed for the items in this order that we ship. Any licences in
              the same order are emailed and do not use it.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="block text-[13px] font-semibold text-ink">
                    Country
                  </span>
                  <select
                    name="shipCountry"
                    required
                    defaultValue={defaultCountry ?? ""}
                    className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px] ${invalid("shipCountry")}`}
                  >
                    <option value="" disabled>
                      Choose a country
                    </option>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Field
                label="Full name"
                name="shipName"
                autoComplete="name"
                className={invalid("shipName")}
                required
              />
              <Field
                label="Postal or ZIP code"
                name="shipPostcode"
                autoComplete="postal-code"
                className={invalid("shipPostcode")}
                hint="Leave blank if your country does not use one."
              />
              <div className="sm:col-span-2">
                <Field
                  label="Address line 1"
                  name="shipLine1"
                  autoComplete="address-line1"
                  className={invalid("shipLine1")}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Address line 2 (optional)"
                  name="shipLine2"
                  autoComplete="address-line2"
                  className={invalid("shipLine2")}
                />
              </div>
              <Field
                label="City or town"
                name="shipCity"
                autoComplete="address-level2"
                className={invalid("shipCity")}
                required
              />
              <Field
                label="State, province or region (optional)"
                name="shipRegion"
                autoComplete="address-level1"
                className={invalid("shipRegion")}
              />
            </div>

            <p className="mt-3 rounded-md border border-line bg-ground/50 p-3 text-[13px] text-muted">
              <span className="font-semibold text-ink">
                Import duty and taxes are not included.
              </span>{" "}
              Your country charges these on arrival and the carrier collects
              them before delivery. They are not ours to quote, and we would
              rather say so here than let you find out at the door.
            </p>
          </fieldset>
        ) : (
          <p className="rounded-lg border border-line bg-surface p-4 text-[14px] text-muted">
            Everything in this order is delivered by email, so there is no
            address to fill in and nothing to clear through customs.
          </p>
        )}

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
                    {PAYMENT_METHOD_NOTES[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {!methods.includes("BANK_TRANSFER") ? (
            <p className="mt-3 text-[13px] text-muted">
              Bank transfer is not offered here because the whole point of this
              order is that the keys arrive in seconds, and a transfer takes
              days to clear.
            </p>
          ) : null}
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="rounded-lg border border-line bg-surface p-4">
          <SubmitButton total={total} method={method} />
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            By placing this order you agree to the terms of sale. A commercial
            invoice is issued to the email address above and travels with the
            shipment.
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
