"use client";

import { useRef } from "react";

/**
 * A quantity box that applies itself when you leave it.
 *
 * A dropdown was fine when the ceiling was ten; typing is the only sane way to
 * ask for two hundred seats. Submitting on `change` rather than on every
 * keystroke matters here — `change` on a number input fires when the field is
 * committed (blur, Enter, or the spinner), so a two-digit quantity does not
 * post the form once for each digit.
 *
 * The fallback for a browser without JavaScript is a submit button hidden by a
 * `@media (scripting: enabled)` rule — the same condition under which
 * `onChange` fires, expressed in CSS. No state, no effect, and nothing for
 * hydration to disagree about.
 */
export function QtyInput({
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
  const ref = useRef<HTMLInputElement>(null);

  return (
    <span className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        name={name}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        step={1}
        defaultValue={String(defaultValue)}
        onChange={() => ref.current?.form?.requestSubmit()}
        className="w-20 rounded-md border border-line bg-ground/50 px-2 py-1 text-[13px] tabular-nums"
      />
      <button
        type="submit"
        className="no-js-only rounded-md border border-line px-2 py-1 text-[13px] font-semibold hover:bg-ground"
      >
        Update
      </button>
    </span>
  );
}
