import { cookies } from "next/headers";

import {
  GoogleTagManager,
  GoogleTagManagerNoScript,
} from "@/components/analytics";
import { CookieConsent } from "@/components/cookie-consent";
import { analyticsAllowed, CONSENT_COOKIE, readConsent } from "@/lib/consent";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PartnerStrip } from "@/components/partner-badges";

/**
 * The storefront's own frame.
 *
 * Kept here rather than in the root layout so that the back office is not
 * wrapped in a shop. Search, categories and the marketing footer belong around
 * anything a customer looks at and around nothing else; an admin page rendered
 * inside them reads as a page of the store, which is exactly what somebody
 * demonstrating the site to a customer must not have happen.
 *
 * Route groups do not appear in URLs, so every path under here is unchanged.
 *
 * The analytics tags and the consent banner live here for the same reason.
 * They were in the root layout, which put them over the back office too: the
 * banner is fixed to the bottom of the window, so it sat on top of whatever
 * control was at the foot of an admin page — the delete confirmation, among
 * others — and an administrator cannot dismiss it for a visitor anyway. It
 * also meant the shop's own staff were counted in the visitor figures, which
 * is the fastest way to make a month of them meaningless.
 */
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read on the server, so the tags are simply absent from the HTML until
  // somebody has agreed rather than injected afterwards by a script that could
  // fire before the answer is known.
  const consent = readConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  const consented = analyticsAllowed(consent);

  return (
    <div className="flex min-h-full flex-col">
      <GoogleTagManagerNoScript consented={consented} />
      <GoogleTagManager consented={consented} />

      {/* Asks once, remembers the answer, and sets nothing until it has one.
          Early in the document although it is painted at the bottom: last in
          the DOM meant a keyboard user had to tab through every product link
          on the home page before they could reach the choice. Position is
          CSS; reachability is document order. */}
      <CookieConsent decided={consent !== null} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <span id="top" />
      <Header />
      <PartnerStrip />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
