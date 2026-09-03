import "server-only";

/**
 * The site's own address, and the things that depend on knowing it.
 *
 * `APP_URL` is configuration rather than something read from the request,
 * because a `Host` header is attacker-controlled — the same reason Stripe's
 * return URL is built from it. A canonical tag or a sitemap built from an
 * attacker-supplied host is worse than none: it invites a copy of this shop on
 * another domain to be indexed as the original.
 */
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absolute(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The shared social-preview image. Whatever links here shows the wordmark. */
export const OG_IMAGE = {
  url: "/brand/vertex-logo-navy@2x.png",
  width: 900,
  height: 170,
  alt: "Vertex Infosolutions",
};

/**
 * JSON-LD, rendered into a script tag.
 *
 * Serialised with the closing-brace sequence escaped: a product name
 * containing `</script>` would otherwise end the tag early and put the rest of
 * the payload into the document as markup.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
