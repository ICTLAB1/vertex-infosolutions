import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage } from "@/components/policy";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "The one cookie this website sets, what it holds, and why there is no consent banner.",
};

export default function CookiesPage() {
  return (
    <PolicyPage title="Cookie policy" updated="2 September 2026">
      <p>
        This website sets one cookie. There is no consent banner because there is
        nothing to consent to — the law requires consent for cookies that are not
        strictly necessary, and we do not set any.
      </p>

      <H2>The cookie</H2>
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

      <H2>What we do not set</H2>
      <p>
        No analytics cookies. No advertising or retargeting pixels. No social
        media embeds. No session recording. No third-party script of any kind
        runs on the pages where you shop.
      </p>
      <p>
        The payment provider sets its own cookies on its own page, once you are
        redirected there to pay. Those are governed by that provider&apos;s
        policy, not this one, and they never appear on this domain.
      </p>

      <H2>Refusing it</H2>
      <p>
        Your browser can block it. The site will still let you browse and search,
        but the basket will empty on every page load, because the cookie is the
        only thing connecting you to it.
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
