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

/** Used when nothing is configured, which is the normal case in production. */
export const DEFAULT_GTM_ID = "GTM-PCS32N99";

/**
 * Which container to load, decided per request.
 *
 * `GTM_ID` and not `NEXT_PUBLIC_GTM_ID`. Anything named `NEXT_PUBLIC_` is
 * substituted into the code while the site is being built, and this site is
 * built inside a container that has none of the deployed settings — so a value
 * set on the web server afterwards could never be seen, and changing it would
 * mean rebuilding rather than restarting. Read from `process.env` here, in a
 * server component, and the setting takes effect on the next request.
 *
 * `GTM_DISABLED=1` is the off switch, and it is what development sets: without
 * it every local page load, every test run and every screenshot lands in the
 * same GA4 property as real customers, and the first month of data is unusable.
 */
export function gtmId(): string {
  if (process.env.GTM_DISABLED === "1") return "";
  return (process.env.GTM_ID ?? DEFAULT_GTM_ID).trim();
}

/**
 * Two gates, and both have to open.
 *
 * `consented` is the visitor's answer, read from a cookie on the server — so
 * the tag is absent from the HTML until somebody has said yes, rather than
 * being injected afterwards by a script that has to be raced. Denied and
 * undecided are the same thing here; they differ only in whether the banner
 * is still asking.
 *
 * There is deliberately no third gate on `NODE_ENV`. It was one before, and it
 * was the wrong control: the thing worth keeping out of the live property is a
 * developer's machine, which `GTM_DISABLED` says directly, rather than
 * whatever a build happens to have set — which on this host is production
 * everywhere, including in a shell somebody opened to try something.
 */
export function gtmEnabled(consented: boolean): boolean {
  return consented && gtmId().length > 0;
}

/** The loader. Goes in the body; pairs with `GoogleTagManagerNoScript`. */
export function GoogleTagManager({ consented }: { consented: boolean }) {
  if (!gtmEnabled(consented)) return null;
  const id = gtmId();

  return (
    <Script id="gtm-loader" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`}
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
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId()}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
