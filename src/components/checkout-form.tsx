"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { placeOrder, type CheckoutError } from "@/app/actions";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/types";

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

function SubmitButton({ total }: { total: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-amber w-full rounded-full py-3 text-[15px] font-semibold"
    >
      {pending ? "Placing your order…" : `Pay ${total} and place order`}
    </button>
  );
}

export function CheckoutForm({
  needsAddress,
  methods,
  total,
}: {
  needsAddress: boolean;
  methods: readonly PaymentMethod[];
  total: string;
}) {
  const [error, action] = useActionState<CheckoutError | null, FormData>(
    placeOrder,
    null,
  );

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
              hint="Invoice, order updates and any licence keys go here."
              required
            />
            <Field
              label="Mobile number"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              className={invalid("phone")}
              hint="Used by the courier only."
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
              Needed for the items in this order that we ship. The licences do
              not use it.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field
                label="Full name"
                name="shipName"
                autoComplete="name"
                className={invalid("shipName")}
                required
              />
              <Field
                label="Pincode"
                name="shipPincode"
                inputMode="numeric"
                autoComplete="postal-code"
                className={invalid("shipPincode")}
                required
              />
              <div className="sm:col-span-2">
                <Field
                  label="Flat, building, street"
                  name="shipLine1"
                  autoComplete="address-line1"
                  className={invalid("shipLine1")}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Area, landmark (optional)"
                  name="shipLine2"
                  autoComplete="address-line2"
                  className={invalid("shipLine2")}
                />
              </div>
              <Field
                label="Town or city"
                name="shipCity"
                autoComplete="address-level2"
                className={invalid("shipCity")}
                required
              />
              <label className="block">
                <span className="block text-[13px] font-semibold text-ink">
                  State
                </span>
                <select
                  name="shipState"
                  required
                  defaultValue=""
                  className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px] ${invalid("shipState")}`}
                >
                  <option value="" disabled>
                    Choose a state
                  </option>
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
        ) : (
          <p className="rounded-lg border border-line bg-surface p-4 text-[14px] text-muted">
            Everything in this order is delivered by email, so there is no
            address to fill in.
          </p>
        )}

        <fieldset className="rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-[15px] font-bold text-ink">
            How would you like to pay?
          </legend>
          <div className="mt-2 space-y-2">
            {methods.map((method, index) => (
              <label
                key={method}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-ground/50 has-checked:border-brand has-checked:bg-brand/5"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  defaultChecked={index === 0}
                  className="mt-1"
                />
                <span>
                  <span className="block text-[14px] font-semibold text-ink">
                    {PAYMENT_METHOD_LABELS[method]}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {method === "COD"
                      ? "Pay the courier when it arrives. Hardware only."
                      : "You are taken to the gateway's own page. Vertex never sees your card or UPI credentials."}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {!methods.includes("COD") ? (
            <p className="mt-3 text-[13px] text-muted">
              Cash on delivery is not offered on orders containing a licence —
              there is nothing for a courier to hand over.
            </p>
          ) : null}
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="rounded-lg border border-line bg-surface p-4">
          <SubmitButton total={total} />
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            By placing this order you agree to the terms of sale. A tax invoice
            is issued to the email address above.
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
      {hint ? <span className="mt-1 block text-[12px] text-faint">{hint}</span> : null}
    </label>
  );
}
