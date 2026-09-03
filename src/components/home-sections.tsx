import Link from "next/link";

import { DELIVERY_WINDOW } from "@/lib/delivery";
import type { CurrencyCode } from "@/lib/market";
import { jsonLd } from "@/lib/seo";
import { getSiteConfig } from "@/lib/site";

/* ------------------------------------------------------------------ shared */

function Section({
  title,
  intro,
  delay = 0,
  children,
}: {
  title: string;
  intro?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="reveal mt-6 rounded-lg border border-line bg-surface p-5"
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {intro ? (
        <p className="mt-1 max-w-3xl text-[14px] text-muted">{intro}</p>
      ) : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

/**
 * Three steps, and the third is the one that has to stay honest.
 *
 * "Receive your licence by email" would be wrong for most of what this shop
 * sells: a Microsoft CSP subscription has no key to email, it arrives as the
 * sign-in details for a tenant provisioned for the order, and it takes a
 * business day rather than a minute. The step says what actually happens.
 */
export function HowItWorks() {
  const steps = [
    {
      n: 1,
      title: "Choose your licence",
      body: "Pick the product and the number of seats. Indian prices include GST; supplies outside India are zero-rated exports.",
    },
    {
      n: 2,
      title: "Pay securely",
      body: "Card, and UPI or net banking on an Indian order, on Stripe's own payment page. Vertex never sees your card details. Bank transfer is offered if your accounts prefer an invoice.",
    },
    {
      n: 3,
      title: "Receive your licence",
      body: `Issued to your Vertex account and emailed to you, ${DELIVERY_WINDOW}. Microsoft subscriptions arrive as the sign-in details for a new tenant rather than as a key.`,
    },
  ];

  return (
    <Section
      title="How licensing works"
      intro="Three steps, and nothing you have to chase."
    >
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.n}
            className="reveal rounded-lg border border-line-soft bg-ground/40 p-4"
            style={{ "--reveal-delay": `${120 + i * 90}ms` } as React.CSSProperties}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nav-2 text-[13px] font-bold text-white">
              {step.n}
            </span>
            <h3 className="mt-2.5 text-[15px] font-bold text-ink">
              {step.title}
            </h3>
            <p className="mt-1 text-[13px] text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
        <p className="text-[14px] font-semibold text-ink">Need help?</p>
        <p className="text-[14px] text-muted">
          Licensing is where money gets wasted. Ask before you buy, not after.
        </p>
        <Link
          href="/contact"
          className="btn-amber rounded-full px-4 py-2 text-[14px] font-semibold transition-transform hover:-translate-y-0.5"
        >
          Talk to our team
        </Link>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------ buy with confidence */

export async function BuyWithConfidence() {
  const config = await getSiteConfig();

  const pillars = [
    {
      title: "Genuine software licences",
      body: "Bought through authorised distribution and supplied under the publisher's own end-user terms. Every listing shows the publisher's own SKU so you can check it is the product you meant.",
      glyph: "shield",
    },
    {
      title: "Authorised reseller",
      body: "An Adobe Certified Reseller, and Microsoft licences supplied through the CSP programme. We sell and support the licence; the publisher owns the software.",
      glyph: "badge",
    },
    {
      title: "Secure payment",
      body: "Payment happens on Stripe's own page. There is no card field anywhere on this site, so there is nothing here for anyone to steal.",
      glyph: "lock",
    },
    {
      title: "Support from a person",
      body: config.supportEmail
        ? `Questions before you buy and problems after. ${config.supportEmail}${config.supportPhone ? ` · ${config.supportPhone}` : ""}`
        : "Questions before you buy and problems after — our contact details are in the footer.",
      glyph: "chat",
    },
  ] as const;

  return (
    <Section title="Buy with confidence" delay={60}>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((pillar, i) => (
          <li
            key={pillar.title}
            className="reveal rounded-lg border border-line-soft bg-ground/40 p-4 transition-shadow hover:shadow-md"
            style={{ "--reveal-delay": `${140 + i * 70}ms` } as React.CSSProperties}
          >
            <Mark name={pillar.glyph} />
            <h3 className="mt-2 text-[14px] font-bold text-ink">
              {pillar.title}
            </h3>
            <p className="mt-1 text-[13px] text-muted">{pillar.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Mark({ name }: { name: "shield" | "badge" | "lock" | "chat" }) {
  const paths = {
    shield: "M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z",
    badge: "M12 3l2.4 1.8 3-.2.6 2.9 2.3 1.9-1.5 2.6 1.5 2.6-2.3 1.9-.6 2.9-3-.2L12 21l-2.4-1.8-3 .2-.6-2.9L3.7 14.6 5.2 12 3.7 9.4l2.3-1.9.6-2.9 3 .2L12 3z",
    lock: "M6 10V8a6 6 0 1112 0v2m-13 0h14v10H5V10z",
    chat: "M4 5h16v11H9l-5 4V5z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand" aria-hidden="true">
      <path
        d={paths[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------- payment methods */

/**
 * What is actually accepted, which is not the same as what the database enum
 * can hold. Checkout offers two routes: Stripe, which presents the local
 * methods for the buyer's country, and bank transfer. PayPal exists in the
 * enum and is not offered, so it is not advertised — a logo for a method that
 * fails at checkout costs more trust than it buys.
 */
export function PaymentMethods({ currency }: { currency: CurrencyCode }) {
  const domestic = currency === "INR";
  const methods = domestic
    ? ["Visa", "Mastercard", "RuPay", "UPI", "Net banking", "Wallets", "Bank transfer"]
    : ["Visa", "Mastercard", "American Express", "Apple Pay", "Google Pay", "Bank transfer"];

  return (
    <Section title="Payment methods" delay={90}>
      <ul className="mt-3 flex flex-wrap gap-2">
        {methods.map((method, i) => (
          <li
            key={method}
            className="reveal rounded-md border border-line bg-ground/50 px-3 py-1.5 text-[13px] font-semibold text-ink"
            style={{ "--reveal-delay": `${160 + i * 40}ms` } as React.CSSProperties}
          >
            {method}
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-3xl text-[13px] text-muted">
        Card payments run on Stripe&apos;s own secure page — the card details
        never touch this site.{" "}
        {domestic
          ? "Which of UPI, net banking and wallets appear is decided by Stripe from your bank and ours."
          : "Which wallets appear depends on your device and country."}{" "}
        Bank transfer is available if your accounts department would rather pay
        against an invoice; the licence is issued once the funds clear.
      </p>
    </Section>
  );
}

/* ----------------------------------------------------------- trust & safety */

export async function TrustAndSecurity() {
  const config = await getSiteConfig();

  const faqs: {
    q: string;
    a: React.ReactNode;
    /** The same answer as text, for the structured data. */
    plain: string;
  }[] = [
    {
      q: "Is my payment secure?",
      plain:
        "Yes. Payment is taken on Stripe's own hosted page, not on ours. There is no card field anywhere on this website, so there is nothing here to intercept. The connection is encrypted end to end and Vertex never receives, stores or sees your card or UPI details.",
      a: (
        <>
          Yes. Payment is taken on Stripe&apos;s own hosted page, not on this
          one. There is no card field anywhere on this website, so there is
          nothing here to intercept. The connection is encrypted end to end and
          Vertex never receives, stores or sees your card or UPI details.
        </>
      ),
    },
    {
      q: "Are the software licences genuine?",
      plain:
        "Yes, and you can check rather than take our word for it. Every listing shows the publisher's own SKU — the identifier on Microsoft's or Adobe's price list — so you can confirm the product is what it says. The licence is supplied under the publisher's own end-user terms, which you accept when you activate it.",
      a: (
        <>
          Yes, and you can check rather than take our word for it. Every listing
          shows the publisher&apos;s own SKU — the identifier on Microsoft&apos;s
          or Adobe&apos;s price list — so you can confirm the product is what it
          says. The licence is supplied under the publisher&apos;s own end-user
          terms, which you accept when you activate it.
        </>
      ),
    },
    {
      q: "Where do the licences come from?",
      plain:
        "Authorised distribution. Microsoft subscriptions are supplied through the Cloud Solution Provider programme; Adobe through our certified reseller agreement. They are not recovered consumer keys, not OEM keys detached from the hardware they were sold with, and not grey-market volume keys.",
      a: (
        <>
          Authorised distribution. Microsoft subscriptions are supplied through
          the Cloud Solution Provider programme; Adobe through our certified
          reseller agreement. They are not recovered consumer keys, not OEM keys
          detached from the hardware they were sold with, and not grey-market
          volume keys — all three of which stop working when the publisher
          audits them, usually months later and always at your expense.{" "}
          <Link href="/licensing" className="text-link underline">
            How licensing works
          </Link>
        </>
      ),
    },
    {
      q: "Can I get a refund?",
      plain:
        "Before the licence is issued, in full and without argument. After it is issued a subscription generally cannot be returned, because the publisher does not take it back — but if it does not work we replace it or refund it, and a licence that never arrived is always refunded.",
      a: (
        <>
          Before the licence is issued, in full and without argument. After it
          is issued a subscription generally cannot be returned, because the
          publisher does not take it back — but if it does not work we replace
          it or refund it, and a licence that never arrived is always refunded.
          The full position, including how the money comes back and how the GST
          is reversed, is in the{" "}
          <Link href="/returns" className="text-link underline">
            refunds policy
          </Link>
          .
        </>
      ),
    },
    {
      q: "Is customer support available?",
      plain:
        "Yes — before you buy as well as after, by email and phone. Licensing is where most money is wasted, and it is wasted before the order rather than after, so ask first.",
      a: (
        <>
          Yes — before you buy as well as after.{" "}
          {config.supportEmail ? (
            <>
              Email{" "}
              <a
                href={`mailto:${config.supportEmail}`}
                className="text-link underline"
              >
                {config.supportEmail}
              </a>
              {config.supportPhone ? <> or call {config.supportPhone}</> : null}.{" "}
            </>
          ) : (
            <>Our contact details are in the footer. </>
          )}
          Licensing is where most money is wasted, and it is wasted before the
          order rather than after, so ask first.
        </>
      ),
    },
  ];

  return (
    <Section
      title="Trust &amp; security"
      intro="The questions worth asking of any supplier you have not bought from before."
      delay={120}
    >
      {/* The same questions and answers as structured data. Google shows
          these under a result, and a shop nobody has bought from yet needs
          every honest signal it can give. The text matches the page exactly —
          structured data that says something the page does not is the one
          way to turn this into a penalty. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.plain },
            })),
          }),
        }}
      />

      <div className="mt-3 divide-y divide-line-soft">
        {faqs.map((faq, i) => (
          <details
            key={faq.q}
            className="reveal group py-3"
            style={{ "--reveal-delay": `${180 + i * 60}ms` } as React.CSSProperties}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-ink">
              {faq.q}
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              >
                <path
                  d="M5 8l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <p className="mt-2 max-w-3xl text-[14px] text-muted">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
