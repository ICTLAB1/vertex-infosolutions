import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { pageMetadata } from "@/lib/seo";
import { H2, PolicyPage } from "@/components/policy";
import { ConsentControl } from "@/components/cookie-consent";
import { CONSENT_COOKIE, readConsent } from "@/lib/consent";

export const metadata: Metadata = pageMetadata({
  title: "Cookie policy",
  description:
    "Which cookies this shop sets, what each one is for, and which of them you can refuse without breaking the basket.",
  path: "/cookies",
});

export default async function CookiesPage() {
  const consent = readConsent((await cookies()).get(CONSENT_COOKIE)?.value);

  return (
    <PolicyPage title="Cookie policy" updated="4 September 2026">
      <p>
        This website sets two cookies of its own, both strictly necessary, and
        loads Google Tag Manager, which sets analytics cookies. Both kinds are
        described below.
      </p>
      <p>
        The analytics ones are not set unless you agree. Nothing asks twice, and
        you can change the answer here at any time:
      </p>
      <ConsentControl consent={consent} />

      <H2>The basket cookie</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <tbody>
            <tr className="border-b border-line-soft">
              <th scope="row" className="w-40 py-2 pr-4 text-left font-semibold text-ink">
                Name
              </th>
              <td className="py-2 font-mono text-[13px]">vx_cart</td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Purpose
              </th>
              <td className="py-2">
                Identifies your shopping basket so it survives a closed tab.
              </td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Contents
              </th>
              <td className="py-2">
                24 random bytes. No name, no email, no prices, no products —
                everything that decides what you owe lives on our server.
              </td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Lifetime
              </th>
              <td className="py-2">30 days</td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Flags
              </th>
              <td className="py-2 font-mono text-[13px]">
                HttpOnly · Secure · SameSite=Lax
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Category
              </th>
              <td className="py-2">Strictly necessary</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <span className="font-semibold text-ink">HttpOnly</span> means no script
        on the page can read it, which is what stops a cross-site scripting bug
        turning into a stolen session.
      </p>

      <H2>The market cookie</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <tbody>
            <tr className="border-b border-line-soft">
              <th scope="row" className="w-40 py-2 pr-4 text-left font-semibold text-ink">
                Name
              </th>
              <td className="py-2 font-mono text-[13px]">vx_market</td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Purpose
              </th>
              <td className="py-2">
                Remembers whether you chose INR or USD, so the store does not
                guess your market again on every visit.
              </td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Contents
              </th>
              <td className="py-2">
                The three letters <span className="font-mono">INR</span> or{" "}
                <span className="font-mono">USD</span>. Nothing else.
              </td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Lifetime
              </th>
              <td className="py-2">180 days</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Category
              </th>
              <td className="py-2">Strictly necessary</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Not HttpOnly, because there is nothing in it worth protecting and the
        page benefits from being able to read its own currency.
      </p>

      <H2>Analytics — only if you agree</H2>
      <p>
        If you allow them, Google Tag Manager loads and, through it, Google
        Analytics 4. Until then neither is on the page at all: the tags are not
        merely inactive, they are absent from the HTML the server sends, so
        there is nothing to fire early or to fail closed. These set
        Google&apos;s own cookies — typically{" "}
        <span className="font-mono text-[13px]">_ga</span> and{" "}
        <span className="font-mono text-[13px]">_ga_&lt;id&gt;</span>, lasting
        up to two years — which count visits and tell us which pages people
        actually read. They belong to Google, not to us, and are governed by
        Google&apos;s policies as well as this one.
      </p>
      <p>
        We use it to see which listings get looked at and where people give up.
        We do not use it to build an advertising profile of you, and there is no
        advertising or remarketing tag in the container.
      </p>

      <H2>The cookie that remembers your answer</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <tbody>
            <tr className="border-b border-line-soft">
              <th scope="row" className="w-40 py-2 pr-4 text-left font-semibold text-ink">
                Name
              </th>
              <td className="py-2 font-mono text-[13px]">vx_consent</td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Contents
              </th>
              <td className="py-2">
                One word — <span className="font-mono">granted</span> or{" "}
                <span className="font-mono">denied</span>.
              </td>
            </tr>
            <tr className="border-b border-line-soft">
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Lifetime
              </th>
              <td className="py-2">One year</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                Category
              </th>
              <td className="py-2">Strictly necessary</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Set only once you have answered. Remembering a refusal is the only way
        to avoid asking again on every page, which is why this one needs no
        consent of its own.
      </p>

      <H2>What we do not set</H2>
      <p>
        No advertising or retargeting pixels. No social media embeds. No session
        recording. Nothing that reads what you type.
      </p>
      <p>
        The payment provider sets its own cookies on its own page, once you are
        redirected there to pay. Those are governed by that provider&apos;s
        policy, not this one, and they never appear on this domain.
      </p>

      <H2>Refusing them</H2>
      <p>
        The analytics ones: say no above, or never answer at all — an ignored
        banner is a no, and the tags stay off. Refusing costs you nothing; the
        shop does not read those cookies and does not behave differently
        without them.
      </p>
      <p>
        Your browser can block any of them too. Blocking ours lets you browse
        and search, but
        the basket will empty on every page load, and the store will re-guess
        your market from your connection each time instead of remembering what
        you picked.
      </p>
      <p>
        Browser-level &ldquo;do not track&rdquo; settings, tracker blockers and
        Google&apos;s own{" "}
        <a
          href="https://tools.google.com/dlpage/gaoptout"
          className="text-link underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          opt-out add-on
        </a>{" "}
        all stop the analytics side, and none of them break the shop.
      </p>

      <H2>Related</H2>
      <p>
        What we do with the data behind the cookie is in the{" "}
        <Link href="/privacy" className="text-link underline">
          privacy policy
        </Link>
        .
      </p>
    </PolicyPage>
  );
}
