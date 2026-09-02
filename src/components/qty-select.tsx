"use client";

import { useRef } from "react";

/**
 * A quantity dropdown that applies itself on change.
 *
 * The fallback for a browser without JavaScript is a submit button hidden by a
 * `@media (scripting: enabled)` rule — the same condition under which
 * `onChange` fires, expressed in CSS. No state, no effect, and nothing for
 * hydration to disagree about.
 */
export function QtySelect({
  name,
  defaultValue,
  max,
  label,
  id,
}: {
  name: string;
  defaultValue: number;
  max: number;
  label: string;
  id: string;
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
        defaultValue={String(defaultValue)}
        onChange={() => ref.current?.form?.requestSubmit()}
        className="rounded-md border border-line bg-ground/50 px-2 py-1 text-[13px]"
      >
        {Array.from({ length: max }, (_, index) => index + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="no-js-only rounded-md border border-line px-2 py-1 text-[13px] font-semibold hover:bg-ground"
      >
        Update
      </button>
    </span>
  );
}
