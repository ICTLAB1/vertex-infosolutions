import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Azure App Service runs this as a container, so the build emits a
   * self-contained server with only the files it actually imports. Without
   * this the image has to carry all of node_modules — roughly ten times the
   * size, and ten times the pull on every scale-out.
   */
  output: "standalone",

  // App Service terminates TLS at the front end and forwards the original
  // scheme in X-Forwarded-Proto. Without this, redirects and absolute URLs
  // generated on the server come back as http:// and the browser blocks them.
  poweredByHeader: false,

  /**
   * One address for the shop, not two.
   *
   * Both `vertexinfosolutions.com` and `www.vertexinfosolutions.com` reach this
   * server. Left alone, a search engine sees two copies of every page and has
   * to guess which is the real one — so the ranking a listing earns is split
   * between two addresses instead of counting once. `APP_URL` already says the
   * www form is the real one, and every canonical tag, the sitemap and
   * robots.txt are built from it; this makes the server agree, by sending
   * anyone who arrives without the www to the same page with it.
   *
   * 308 rather than 301: it means the same thing to a search engine and, unlike
   * 301, browsers are required to keep the request method, so a form posted to
   * the bare domain still arrives as a POST.
   *
   * Query strings ride along without being mentioned — Next.js carries them to
   * the destination — which matters because a link with `?utm_source=` on the
   * end is exactly the kind that gets shared.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "vertexinfosolutions.com" }],
        destination: "https://www.vertexinfosolutions.com/:path*",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Sent by Azure Front Door / App Service anyway, but set here so the
          // guarantee does not depend on the hosting layer being configured.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
