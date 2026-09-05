import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";

import { jsonLd, OG_IMAGE, siteUrl } from "@/lib/seo";
import { getSiteConfig } from "@/lib/site";

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
  const seller = await getSiteConfig();

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
        {/* Who this business is, and how to search it. Stated once, at the
            root, rather than repeated per page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  /*
                    Organization, and deliberately not LocalBusiness.

                    LocalBusiness is for a business customers come to — a shop,
                    a clinic, a branch — and it is what makes a map pin and
                    opening hours eligible. This one sells licences over the
                    internet to buyers outside India who will never visit an
                    address. Marking it up as a local business to try for a map
                    result is misrepresentation of the kind Google issues
                    manual actions for, and the result it wins would send
                    nobody anywhere useful. Organization is the correct type,
                    and it carries everything that actually establishes who
                    this seller is.

                    Every field below is rendered only when it is configured.
                    An organisation whose legal name or tax number is a
                    placeholder is worse than one that stays quiet: the whole
                    value of this block is that a search engine can check it
                    against a company register and find it true.
                  */
                  "@type": "Organization",
                  "@id": `${siteUrl()}/#organization`,
                  name: seller.tradingName,
                  ...(seller.legalName ? { legalName: seller.legalName } : {}),
                  url: siteUrl(),
                  logo: {
                    "@type": "ImageObject",
                    url: `${siteUrl()}${OG_IMAGE.url}`,
                    width: OG_IMAGE.width,
                    height: OG_IMAGE.height,
                  },
                  description:
                    "Authorised reseller of Microsoft, Adobe and Autodesk software licences. Microsoft Solutions Partner, Adobe Certified Reseller and Autodesk Reseller, supplying worldwide by electronic delivery.",
                  ...(seller.address
                    ? {
                        address: {
                          "@type": "PostalAddress",
                          streetAddress: seller.address,
                          addressCountry: "IN",
                        },
                      }
                    : {}),
                  // The tax registration is the strongest identity signal a
                  // seller has: it is a number anybody can check against a
                  // government register, which no amount of marketing copy is.
                  ...(seller.taxIdNumber
                    ? {
                        taxID: seller.taxIdNumber,
                        identifier: {
                          "@type": "PropertyValue",
                          name: seller.taxIdLabel ?? "Tax ID",
                          value: seller.taxIdNumber,
                        },
                      }
                    : {}),
                  ...(seller.supportEmail
                    ? {
                        contactPoint: {
                          "@type": "ContactPoint",
                          contactType: "customer support",
                          email: seller.supportEmail,
                          availableLanguage: ["en"],
                          areaServed: "001",
                        },
                      }
                    : {}),
                  // Who this shop is authorised by. A reseller's whole claim is
                  // that its supply chain is real, and naming the three
                  // publishers as related entities is how that claim is made
                  // in data rather than in a badge image.
                  knowsAbout: [
                    "Microsoft 365",
                    "Microsoft Azure",
                    "Adobe Creative Cloud",
                    "Autodesk AutoCAD",
                    "Software licensing",
                    "Cloud Solution Provider programme",
                  ],
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
