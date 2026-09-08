import type { Metadata } from "next";
import Link from "next/link";

import { H2, PolicyPage, Ul } from "@/components/policy";
import { absolute, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Why a CSP order creates a new Microsoft tenant",
  description:
    "A Microsoft CSP subscription cannot be added to a tenant that already exists in another region. What that means for your existing users, mailboxes and data, and what to do if you need the seats in your current tenant.",
  path: "/licensing/csp-new-tenant",
});

/**
 * The question that costs support time on every Microsoft order.
 *
 * It is explained three times inside the checkout and nowhere a search engine
 * can find it, which is the wrong way round: somebody deciding whether to buy
 * needs the answer before they reach a basket, and nobody else has written it
 * plainly. The three questions below are the ones actually asked, in the words
 * they are asked in.
 */
const FAQ = [
  {
    q: "Can I add a CSP subscription to my existing Microsoft tenant?",
    a: "Not to one in a different region from the one the subscription is bought in. A Cloud Solution Provider subscription is transacted in the reseller's own market and Microsoft ties it to a tenant in that market, so a subscription bought through an Indian partner cannot be attached to a tenant that was created elsewhere. If your tenant is already in the same region as your partner, it can — ask before ordering and we will check.",
  },
  {
    q: "What happens to my existing users, mailboxes and data?",
    a: "Nothing. They stay exactly where they are, in the tenant they are already in. The new tenant is a separate Microsoft organisation beside your existing one, with its own users, its own mailboxes and its own sign-ins. Nothing is moved, merged or migrated by the act of ordering.",
  },
  {
    q: "What do I actually receive?",
    a: "A tenant ID and the sign-in for a global administrator account in that tenant, sent to the address on your order within one business day. You assign the seats to your own people from the Microsoft 365 admin centre using that account, and you change the password on first sign-in.",
  },
  {
    q: "Can the two tenants share anything?",
    a: "They can be connected, but that is configuration work rather than something the order does. Cross-tenant collaboration in Teams, guest access in SharePoint and cross-tenant synchronisation in Entra ID all exist and all have to be set up deliberately. If you need one directory rather than two, say so before buying and we will tell you honestly whether this route suits you.",
  },
  {
    q: "Is this specific to Vertex?",
    a: "No. It is how the CSP programme works for every partner in every market, and any reseller telling you otherwise is either in your own region or has not checked. It is written down here because most resellers leave it to be discovered after payment.",
  },
];

export default function CspTenantPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            // A genuine FAQ page: five distinct questions, each with a complete
            // answer that stands on its own. Not a product page wearing FAQ
            // markup to win extra space in a result, which is what the format
            // is usually abused for.
            "@type": "FAQPage",
            "@id": `${absolute("/licensing/csp-new-tenant")}#faq`,
            mainEntity: FAQ.map((entry) => ({
              "@type": "Question",
              name: entry.q,
              acceptedAnswer: { "@type": "Answer", text: entry.a },
            })),
          }),
        }}
      />

      <PolicyPage
        title="Why a CSP order creates a new Microsoft tenant"
        updated="8 September 2026"
      >
        <p>
          <strong className="text-ink">The short answer.</strong> A Microsoft
          subscription bought through the Cloud Solution Provider programme is
          transacted in the region the reseller trades in, and Microsoft ties it
          to a tenant in that region. Vertex trades in India, so an order here
          provisions a new Indian tenant with its own tenant ID and its own
          global administrator sign-in. Your existing users, mailboxes and data
          stay exactly where they are, untouched, in the tenant they are in now.
        </p>
        <p>
          If that is not what you wanted, stop before you buy and{" "}
          <Link href="/contact" className="text-link underline">
            ask us
          </Link>
          . It is a fixable problem before an order and an awkward one after.
        </p>

        <H2>What you receive, and when</H2>
        <Ul>
          <li>A tenant ID — the identifier for the new Microsoft organisation.</li>
          <li>
            The sign-in for a global administrator account inside it, which you
            use to assign seats to your own people.
          </li>
          <li>
            Both within one business day of payment clearing, to the confirmed
            address on your account, and on your order page permanently.
          </li>
        </Ul>
        <p>
          Change that administrator password at first sign-in. It is issued to
          you and it is yours from that moment.
        </p>

        <H2>What this does not do</H2>
        <Ul>
          <li>
            It does not move your email. Mailboxes stay in the tenant they are
            in.
          </li>
          <li>
            It does not merge directories. The two tenants have separate user
            lists.
          </li>
          <li>
            It does not affect any subscription you already hold. Those renew,
            or do not, exactly as before.
          </li>
          <li>
            It does not lock you in. The tenant is yours; a subscription can be
            transferred to another partner at renewal.
          </li>
        </Ul>

        <H2>If you need the seats in your existing tenant</H2>
        <p>
          There are three honest routes, and which one applies depends on where
          your tenant already is.
        </p>
        <Ul>
          <li>
            <strong className="text-ink">Your tenant is already in India.</strong>{" "}
            Then the subscription can usually be added to it directly. Tell us
            the tenant domain before ordering and we will confirm it rather than
            guess.
          </li>
          <li>
            <strong className="text-ink">
              Your tenant is elsewhere and you want one directory.
            </strong>{" "}
            Buy from a partner in your own region. We will say so rather than
            sell you something that will not do what you need — and if you tell
            us where you are, we will say which programme applies.
          </li>
          <li>
            <strong className="text-ink">
              Two tenants are acceptable if they can talk to each other.
            </strong>{" "}
            They can. Cross-tenant collaboration, guest access and directory
            synchronisation all exist. It is configuration work, not something
            the order performs, so plan for it rather than assume it.
          </li>
        </Ul>

        <H2>Questions we are actually asked</H2>
        <div className="space-y-4">
          {FAQ.map((entry) => (
            <div key={entry.q}>
              <h3 className="text-[15px] font-bold text-ink">{entry.q}</h3>
              <p className="mt-1">{entry.a}</p>
            </div>
          ))}
        </div>

        <H2>Where this is said before you pay</H2>
        <p>
          On every affected product page, in the basket, and again on the
          checkout page — because somebody expecting new seats to appear beside
          their existing users has bought the wrong thing, and finding that out
          afterwards is our failure rather than theirs. See{" "}
          <Link href="/licensing" className="text-link underline">
            how licensing works
          </Link>{" "}
          for the rest of it, or{" "}
          <Link href="/s?brand=microsoft" className="text-link underline">
            browse Microsoft licences
          </Link>
          .
        </p>
      </PolicyPage>
    </>
  );
}
