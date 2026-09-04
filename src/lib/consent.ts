/**
 * Whether this visitor has agreed to be measured.
 *
 * The decision lives in a first-party cookie rather than in `localStorage`, so
 * the server can read it while rendering. That matters more than it sounds:
 * it means the analytics tags are simply absent from the HTML until somebody
 * has said yes, instead of being injected by a script that runs after the page
 * has already loaded. Nothing to race, nothing to flash, and no window in
 * which a tag fires before the answer is known.
 *
 * The cookie holding the preference is itself strictly necessary — remembering
 * "no" is the only way to stop asking — so it needs no consent of its own.
 * That is the same exemption every consent banner relies on.
 */

export const CONSENT_COOKIE = "vx_consent";

/** A year. Long enough not to nag, short enough that consent is not forever. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type Consent = "granted" | "denied";

/**
 * What the cookie says, if anything.
 *
 * `null` means undecided — which is treated exactly like "denied" everywhere
 * that matters, and differs only in that the banner is still shown. Anything
 * unrecognised is undecided too: a mangled value must never read as consent.
 */
export function readConsent(value: string | undefined | null): Consent | null {
  return value === "granted" || value === "denied" ? value : null;
}

/** Only a definite yes counts. */
export function analyticsAllowed(consent: Consent | null): boolean {
  return consent === "granted";
}
