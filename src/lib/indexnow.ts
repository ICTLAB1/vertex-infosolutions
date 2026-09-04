import "server-only";

import { absolute, siteUrl } from "@/lib/seo";

/**
 * Telling Bing a page has changed, instead of waiting to be crawled.
 *
 * IndexNow is a one-line notification: post the addresses that changed and the
 * search engines that share the protocol — Bing, Yandex, Seznam, Naver — fetch
 * them rather than rediscovering them on their own schedule, which for a shop
 * this size can be weeks. Google does not take part; its equivalent is the
 * sitemap, which this site already publishes.
 *
 * Proving the site is ours is done by hosting a file named after the key at
 * the top of the domain, containing the key and nothing else. Anyone can read
 * it — that is the point of it. It is not a secret and nothing is protected by
 * it; it only shows that whoever posted the notification can also write to
 * this website.
 */

/**
 * The key, and the name of the file that proves it.
 *
 * A constant rather than a required setting, because the file that has to
 * match it is committed beside this code — see `public/`. Changing
 * `INDEXNOW_KEY` on the server alone would leave the notification pointing at
 * a file that is not there, and every submission would be rejected; change
 * both together or neither.
 */
export const DEFAULT_INDEXNOW_KEY = "910aac6125fe4b1bf773d14be0766b58";

export function indexNowKey(): string {
  return (process.env.INDEXNOW_KEY ?? DEFAULT_INDEXNOW_KEY).trim();
}

/** Where the key file lives. Absolute, because the API asks for a full URL. */
export function indexNowKeyLocation(): string {
  return absolute(`/${indexNowKey()}.txt`);
}

/**
 * Notify the search engines that these pages changed.
 *
 * Deliberately unable to fail its caller. This runs at the end of an
 * administrator saving a price or withdrawing a listing, and that save has
 * already happened: an unreachable search engine must not turn a successful
 * change into an error message, and must not undo it. Everything below either
 * returns quietly or logs.
 *
 * Nothing is sent from a machine whose address is localhost — the API would
 * reject it, and a developer testing the back office should not be posting
 * this shop's addresses at all.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  const site = siteUrl();
  const host = new URL(site).host;

  if (urls.length === 0) return;
  if (/^(localhost|127\.|\[?::1)/.test(host)) return;

  // Absolute, on this host, deduplicated: the API rejects the whole batch if
  // one entry belongs to a different domain.
  const urlList = [
    ...new Set(
      urls.map((url) => (url.startsWith("http") ? url : absolute(url))),
    ),
  ].filter((url) => url.startsWith(`${site}/`) || url === site);

  if (urlList.length === 0) return;

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: indexNowKey(),
        keyLocation: indexNowKeyLocation(),
        urlList,
      }),
      // A search engine is not worth holding an administrator's page open for.
      signal: AbortSignal.timeout(5000),
    });

    // 200 and 202 both mean accepted. 422 is the one worth reading in the log:
    // it means the key file did not match, which is the mistake described above.
    if (!response.ok) {
      console.warn(
        `IndexNow refused ${urlList.length} URL(s): ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.warn("IndexNow could not be reached.", error);
  }
}
