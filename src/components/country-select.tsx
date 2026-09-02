"use client";

import { useRef } from "react";

import { COUNTRIES } from "@/lib/shipping";

/**
 * Destination picker. Applies itself on change, with a submit button behind a
 * `@media (scripting: enabled)` rule for anyone without JavaScript — the same
 * condition under which `onChange` fires, expressed in CSS rather than in
 * `<noscript>`, which React cannot hydrate.
 */
export function CountrySelect({
  name = "country",
  value,
  id,
  label,
  className = "",
}: {
  name?: string;
  value: string | null;
  id: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <span className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        ref={ref}
        name={name}
        defaultValue={value ?? ""}
        onChange={() => ref.current?.form?.requestSubmit()}
        className={className}
      >
        <option value="">Select a country…</option>
        {COUNTRIES.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
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
