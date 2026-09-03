"use client";

import { useRef } from "react";

import { CURRENCIES, type CurrencyCode } from "@/lib/market";

/**
 * The market switch.
 *
 * Applies itself on change, with a submit button behind a
 * `@media (scripting: enabled)` rule for anyone without JavaScript — the same
 * condition under which `onChange` fires, expressed in CSS rather than in
 * `<noscript>`, which React cannot hydrate.
 *
 * This is deliberately prominent rather than buried in a footer. The store
 * guesses the market from the request, and a guess about somebody's country is
 * wrong often enough — a VPN, a travelling buyer, an Indian company paying from
 * a Singapore entity — that the correction has to be one obvious click.
 */
export function CurrencySelect({
  value,
  id,
  className = "",
}: {
  value: CurrencyCode;
  id: string;
  className?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <span className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor={id}>
        Currency and market
      </label>
      <select
        id={id}
        ref={ref}
        name="currency"
        defaultValue={value}
        onChange={() => ref.current?.form?.requestSubmit()}
        className={className}
      >
        {Object.values(CURRENCIES).map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.symbol} {currency.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="no-js-only rounded-md border border-line px-2 py-1 text-[13px] font-semibold"
      >
        Apply
      </button>
    </span>
  );
}
