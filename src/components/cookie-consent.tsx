"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  type Consent,
} from "@/lib/consent";

/**
 * Writing the choice.
 *
 * `document.cookie` rather than a server action: this is the one cookie the
 * page is allowed to set without asking, it holds four letters, and a round
 * trip to record "no thank you" would be slower than the thing it declines.
 * `SameSite=Lax` and `Secure` on HTTPS, so it behaves like the shop's other
 * cookies.
 */
function remember(choice: Consent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

/**
 * The banner.
 *
 * Shown only while the choice is unmade. Two buttons, equally weighted and
 * equally easy to hit — a "reject" that is greyed out, hidden behind a second
 * screen or smaller than "accept" is a dark pattern, and the law it is meant
 * to satisfy says consent has to be as easy to refuse as to give.
 *
 * It does not block the page. Nothing here is set until a button is pressed,
 * so a visitor who ignores it entirely is simply not measured — which is the
 * correct outcome and not one worth trapping them in a modal over.
 */
export function CookieConsent({ decided }: { decided: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (decided || dismissed) return null;

  const choose = (choice: Consent) => {
    remember(choice);
    setDismissed(true);
    // Re-render on the server so the tags appear — or stay absent — without a
    // full reload. The choice is already written, so this cannot lose it.
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p id="consent-title" className="text-[15px] font-bold text-ink">
            Analytics cookies
          </p>
          <p className="mt-0.5 max-w-2xl text-[13px] text-muted">
            We would like to count visits with Google Analytics, to see which
            listings people actually read. It is not needed for the shop to
            work, and saying no costs you nothing.{" "}
            <Link href="/cookies" className="text-link underline">
              What we would set
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Deliberately identical: same size, same weight, same colour, one
              click each. A refuse button that is quieter than the accept one
              is the nudge every regulator names first, and the rule it breaks
              is that consent must be as easy to withhold as to give. */}
          <button
            type="button"
            onClick={() => choose("denied")}
            disabled={pending}
            className="min-w-[110px] rounded-full border border-ink bg-surface px-5 py-2 text-[14px] font-semibold text-ink hover:bg-ground/60 disabled:opacity-60"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            disabled={pending}
            className="min-w-[110px] rounded-full border border-ink bg-surface px-5 py-2 text-[14px] font-semibold text-ink hover:bg-ground/60 disabled:opacity-60"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Changing your mind, on the cookie policy page.
 *
 * A consent you cannot withdraw is not consent, and burying the control in a
 * browser settings menu does not count. This states the current answer in
 * words and offers the other one.
 */
export function ConsentControl({ consent }: { consent: Consent | null }) {
  const [current, setCurrent] = useState(consent);
  const router = useRouter();

  const set = (choice: Consent) => {
    remember(choice);
    setCurrent(choice);
    router.refresh();
  };

  return (
    <div className="rounded-md border border-line bg-ground/50 p-4">
      <p className="text-[14px] font-semibold text-ink">
        {current === "granted"
          ? "You have allowed analytics cookies."
          : current === "denied"
            ? "You have refused analytics cookies."
            : "You have not been asked yet on this device."}
      </p>
      <p className="mt-1 text-[13px] text-muted">
        {current === "granted"
          ? "Google Analytics is loading on these pages. You can stop it at any time, and nothing about the shop changes if you do."
          : "Google Analytics is not loading. Nothing is being recorded about your visit beyond the server logs described below."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => set("denied")}
          disabled={current === "denied"}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink hover:bg-ground/60 disabled:opacity-50"
        >
          Refuse analytics
        </button>
        <button
          type="button"
          onClick={() => set("granted")}
          disabled={current === "granted"}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink hover:bg-ground/60 disabled:opacity-50"
        >
          Allow analytics
        </button>
      </div>
    </div>
  );
}
