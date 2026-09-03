import type { MetadataRoute } from "next";

import { absolute } from "@/lib/seo";

/**
 * What a crawler may read.
 *
 * The catalogue and the policies are the point of the site and are open. The
 * disallowed paths are either private (an account, an order, the back office)
 * or meaningless to index (a basket, a checkout, an API route) — and a crawler
 * following them generates sessions and carts that nobody will ever use.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/account",
          "/cart",
          "/checkout",
          "/signin",
          "/register",
          "/verify",
          "/forgot",
          "/reset",
          "/api/",
        ],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
