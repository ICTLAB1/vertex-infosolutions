import type { MetadataRoute } from "next";

import { absolute } from "@/lib/seo";

/**
 * What a crawler may read.
 *
 * The catalogue and the policies are the point of the site and are open.
 * Everything closed off is closed for one of two reasons, and the list below
 * says which.
 *
 * Note this is a crawling instruction, not a security control: a disallowed
 * path is still reachable by anybody who types it. `/admin` and `/account` are
 * protected by `requireAdmin` and a session check; they appear here only so a
 * crawler does not waste its time being redirected to a sign-in page.
 */
/**
 * Read at request time, for the same reason as the sitemap.
 *
 * The sitemap line is built from `APP_URL`, and the image is built without one
 * — so prerendering this at build time bakes in `http://localhost:3000` and
 * ships a robots.txt pointing crawlers at a sitemap that does not exist. It
 * cost nothing to notice here and would have been invisible in production
 * until somebody wondered why nothing was being indexed.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Private, or meaningless to index. A crawler following these
          // generates sessions and baskets nobody will ever use.
          "/admin",
          "/account/",
          "/cart",
          "/checkout",
          "/signin",
          "/register",
          "/verify",
          "/forgot",
          "/reset",
          "/api/",
          // Faceted search. Every combination of these is the same catalogue
          // in a different order, and letting a crawler enumerate them spends
          // the site's crawl budget on thousands of near-duplicate pages
          // instead of on the listings. `/s` and `/s?q=` stay open, because a
          // search page for a real query is a page worth having indexed.
          "/s?*sort=",
          "/s?*maxPrice=",
          "/s?*minRating=",
          "/s?*term=",
        ],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
