import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";

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
  title: {
    default: "Vertex Infosolutions — Microsoft, Adobe and Autodesk licences",
    template: "%s · Vertex Infosolutions",
  },
  description:
    "Buy Microsoft, Adobe and Autodesk software licences online. Keys delivered to your account by email, priced in INR for India and USD everywhere else.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
