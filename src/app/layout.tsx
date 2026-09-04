import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";

import { cookies } from "next/headers";

import {
  GoogleTagManager,
  GoogleTagManagerNoScript,
} from "@/components/analytics";
import { CookieConsent } from "@/components/cookie-consent";
import { analyticsAllowed, CONSENT_COOKIE, readConsent } from "@/lib/consent";
import { jsonLd, OG_IMAGE, siteUrl } from "@/lib/seo";

import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

// SKUs, order numbers and quantities line up in columns, so they get a face
// with tabular figures rather than the body font.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Every relative URL below — canonicals, social images — resolves against
  // this. Configuration rather than the request's Host header, which is
  // attacker-controlled: a canonical tag built from it would invite a copy of
  // this shop on another domain to be indexed as the original.
  metadataBase: new URL(siteUrl()),
  title: {
    default:
      "Vertex Infosolutions — Microsoft, Adobe and Autodesk licences",
    template: "%s · Vertex Infosolutions",
  },
  description:
    "Buy genuine Microsoft, Adobe and Autodesk software licences online. An authorised reseller: Microsoft Solutions Partner, Adobe Certified Reseller, Autodesk Reseller. Priced in INR with GST for India and USD everywhere else.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Vertex Infosolutions",
    title: "Vertex Infosolutions — Microsoft, Adobe and Autodesk licences",
    description:
      "Genuine software licences from an authorised reseller. GST invoice on every Indian order; zero-rated exports elsewhere.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertex Infosolutions — Microsoft, Adobe and Autodesk licences",
    description:
      "Genuine software licences from an authorised reseller. GST invoice on every Indian order; zero-rated exports elsewhere.",
    images: [OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read here, not in a client component: the analytics tags are then simply
  // absent from the HTML until somebody has agreed, rather than injected after
  // the fact by a script that could fire before the answer is known.
  const consent = readConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  const consented = analyticsAllowed(consent);

  return (
    <html
      lang="en-IN"
      className={`${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/*
        Nothing but the document here. The storefront's header and footer live
        in the (store) group's layout, so the back office is not wrapped in a
        shop — see `app/(store)/layout.tsx`.
      */}
      <body className="min-h-full font-sans">
        {/* First thing in the body, where GTM's own instructions put it and
            where its debugger looks for it. */}
        <GoogleTagManagerNoScript consented={consented} />
        <GoogleTagManager consented={consented} />

        {/* Asks once, remembers the answer, and sets nothing until it has one.
            Near the top of the document although it is painted at the bottom:
            last in the DOM meant a keyboard user had to tab through the whole
            page — every product link on the home page — before they could
            reach the choice. Position is CSS; reachability is document order. */}
        <CookieConsent decided={consent !== null} />

        {/* Who this business is, and how to search it. Stated once, at the
            root, rather than repeated per page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl()}/#organization`,
                  name: "Vertex Infosolutions",
                  url: siteUrl(),
                  logo: `${siteUrl()}${OG_IMAGE.url}`,
                  description:
                    "Authorised reseller of Microsoft, Adobe and Autodesk software licences.",
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl()}/#website`,
                  url: siteUrl(),
                  name: "Vertex Infosolutions",
                  publisher: { "@id": `${siteUrl()}/#organization` },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: `${siteUrl()}/s?q={search_term_string}`,
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
