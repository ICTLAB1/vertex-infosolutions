import Link from "next/link";

import { configWarnings, getSiteConfig } from "@/lib/site";

const COLUMNS = [
  {
    heading: "Buy from us",
    links: [
      { href: "/s", label: "Full catalogue" },
      { href: "/s?category=software", label: "Software licences" },
      { href: "/s?category=laptops", label: "Business laptops" },
      { href: "/delivery", label: "Delivery and pincodes" },
    ],
  },
  {
    heading: "Your order",
    links: [
      { href: "/orders", label: "Track an order" },
      { href: "/returns", label: "Returns and refunds" },
      { href: "/cart", label: "Your cart" },
    ],
  },
  {
    heading: "Policies",
    links: [
      { href: "/terms", label: "Terms of sale" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/returns", label: "Refund policy" },
      { href: "/grievance", label: "Grievance redressal" },
    ],
  },
];

export function Footer() {
  const config = getSiteConfig();
  const missing =
    process.env.NODE_ENV === "production" ? [] : configWarnings(config);

  return (
    <footer className="mt-12">
      <Link
        href="#top"
        className="block bg-nav-2 py-3 text-center text-sm font-medium text-white hover:bg-nav-2/90"
      >
        Back to top
      </Link>

      <div className="bg-nav text-white/80">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3 text-[15px] font-semibold text-white">
                {column.heading}
              </h2>
              <ul className="space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="mb-3 text-[15px] font-semibold text-white">
              Talk to a person
            </h2>
            <ul className="space-y-2 text-sm">
              {config.supportPhone ? (
                <li>
                  <a
                    href={`tel:${config.supportPhone.replace(/\s+/g, "")}`}
                    className="hover:underline"
                  >
                    {config.supportPhone}
                  </a>
                </li>
              ) : null}
              {config.supportEmail ? (
                <li>
                  <a
                    href={`mailto:${config.supportEmail}`}
                    className="hover:underline"
                  >
                    {config.supportEmail}
                  </a>
                </li>
              ) : null}
              <li className="pt-1 text-white/60">
                Monday to Saturday, 9:30 am – 6:30 pm IST
              </li>
            </ul>
          </div>
        </div>

        {/* The identity block. Required by the e-commerce rules, and the first
            thing a cautious buyer scrolls down to look for. */}
        <div className="border-t border-white/15">
          <div className="mx-auto max-w-[1500px] px-4 py-6 text-[13px] leading-relaxed text-white/65">
            <p className="font-semibold text-white/90">
              {config.legalName ?? config.tradingName}
            </p>
            {config.address ? <p>{config.address}</p> : null}
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px]">
              {config.gstin ? <span>GSTIN {config.gstin}</span> : null}
              {config.cin ? <span>CIN {config.cin}</span> : null}
            </p>
            {config.grievanceName ? (
              <p className="mt-3">
                Grievance officer: {config.grievanceName}
                {config.grievanceEmail ? (
                  <>
                    {" · "}
                    <a
                      href={`mailto:${config.grievanceEmail}`}
                      className="underline"
                    >
                      {config.grievanceEmail}
                    </a>
                  </>
                ) : null}
                {config.grievancePhone ? ` · ${config.grievancePhone}` : null}
              </p>
            ) : null}
            <p className="mt-3 text-white/50">
              Prices include GST. A tax invoice is issued with every order.
            </p>
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="border-t border-amber/40 bg-amber/10">
            <div className="mx-auto max-w-[1500px] px-4 py-3 text-[13px] text-amber">
              <span className="font-semibold">Not ready to launch.</span> These
              are required before taking a real order and are unset:{" "}
              <span className="font-mono">{missing.join(", ")}</span>. This
              notice is shown in development only.
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
