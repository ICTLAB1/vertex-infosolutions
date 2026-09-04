import Script from "next/script";

/**
 * Google Tag Manager.
 *
 * The container is what loads GA4 (G-ZENKTB8NNW) and anything else added to it
 * later, so there is deliberately no second gtag.js snippet here: two of them
 * would double-count every page view.
 *
 * `afterInteractive` rather than `beforeInteractive`. Analytics is never worth
 * delaying the page for — a shop that renders a hundred milliseconds later to
 * measure itself has measured the wrong thing.
 */

/**
 * Nothing is sent from a developer's laptop.
 *
 * Otherwise every local page load, every test run and every screenshot lands
 * in the same GA4 property as real customers, and the first month of data is
 * unusable. Overridable so a staging environment can point at its own
 * container rather than silently sharing production's.
 */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-PCS32N99";

/**
 * Two gates, and both have to open.
 *
 * `consented` is the visitor's answer, read from a cookie on the server — so
 * the tag is absent from the HTML until somebody has said yes, rather than
 * being injected afterwards by a script that has to be raced. Denied and
 * undecided are the same thing here; they differ only in whether the banner
 * is still asking.
 */
export function gtmEnabled(consented: boolean): boolean {
  return (
    consented && process.env.NODE_ENV === "production" && GTM_ID.length > 0
  );
}

/** The loader. Goes in the body; pairs with `GoogleTagManagerNoScript`. */
export function GoogleTagManager({ consented }: { consented: boolean }) {
  if (!gtmEnabled(consented)) return null;

  return (
    <Script id="gtm-loader" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}

/**
 * The fallback for a visitor with JavaScript off.
 *
 * Must be the first thing inside `<body>`: that is where GTM's own
 * installation instructions put it, and where its debugger looks for it.
 *
 * Gated on consent like the loader, and for a sharper reason: a visitor
 * without JavaScript cannot be shown a banner or record an answer, so this
 * iframe would fire for somebody who was never asked. It therefore appears
 * only for a visitor who has already said yes with JavaScript on.
 */
export function GoogleTagManagerNoScript({
  consented,
}: {
  consented: boolean;
}) {
  if (!gtmEnabled(consented)) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
