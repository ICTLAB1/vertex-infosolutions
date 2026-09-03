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
