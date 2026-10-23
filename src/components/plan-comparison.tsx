import { Fragment } from "react";
import Link from "next/link";

import { comparisonFor } from "@/data/plan-comparison";

/**
 * The plan comparison table on a Microsoft product page.
 *
 * A real table, with the capability as each row's header and the plan as each
 * column's, because that is what this is. Said as a grid of boxes a screen
 * reader cannot announce "Desktop apps, Business Standard, included" — it can
 * only read the cells out in order, which for a sixteen-row chart is useless.
 *
 * Inclusion is never carried by the symbol alone. Every cell also holds a word
 * only assistive technology reads, so the table does not depend on seeing the
 * difference between a dot and a dash.
 *
 * The column for the product whose page this is gets a tint and the word
 * "this plan", so a buyer can see where they are standing before reading
 * across. It links to nothing — you are already there.
 */
export function PlanComparison({ slug }: { slug: string }) {
  const match = comparisonFor(slug);
  if (!match) return null;

  const { chart, highlight } = match;

  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[15px] font-bold text-ink">{chart.title}</h2>
      <p className="mb-3 text-[13px] text-muted">
        As published by Microsoft. Prices shown elsewhere on this page include
        GST; Microsoft quotes its own list prices before tax.
      </p>

      {/* The table scrolls inside this box, so a narrow screen never scrolls
          the whole page sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <caption className="sr-only">
            {chart.title}. Each row is a capability and each column a plan.
          </caption>
          <thead>
            <tr className="border-b border-line-soft">
              <th
                scope="col"
                className="bg-ground/60 px-3 py-2 text-left font-semibold text-ink"
              >
                Capability
              </th>
              {chart.plans.map((plan) => {
                const isThis = plan.key === highlight;
                return (
                  <th
                    key={plan.key}
                    scope="col"
                    className={`px-3 py-2 text-center font-semibold text-ink ${
                      isThis ? "bg-amber/20" : "bg-ground/60"
                    }`}
                  >
                    {isThis ? (
                      <>
                        {plan.label}
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">
                          this plan
                        </span>
                      </>
                    ) : (
                      <Link
                        href={`/product/${plan.slug}`}
                        className="text-ink hover:text-link hover:underline"
                      >
                        {plan.label}
                      </Link>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {chart.sections.map((section) => (
              <Fragment key={section.section}>
                <tr className="border-b border-line-soft">
                  <th
                    scope="colgroup"
                    colSpan={chart.plans.length + 1}
                    className="px-3 pb-1 pt-4 text-left text-[11px] font-semibold uppercase tracking-wide text-faint"
                  >
                    {section.section}
                  </th>
                </tr>

                {section.rows.map((row) => (
                  <tr key={row.feature} className="border-b border-line-soft">
                    <th
                      scope="row"
                      className="px-3 py-2 text-left font-normal text-muted"
                    >
                      {row.feature}
                    </th>
                    {chart.plans.map((plan) => {
                      const state = row.plans[plan.key];
                      const isThis = plan.key === highlight;
                      return (
                        <td
                          key={plan.key}
                          className={`px-3 py-2 text-center ${isThis ? "bg-amber/10" : ""}`}
                        >
                          {state === true ? (
                            <>
                              <span aria-hidden className="text-brand">
                                &#9679;
                              </span>
                              <span className="sr-only">Included</span>
                            </>
                          ) : state === "add-on" ? (
                            <>
                              <span aria-hidden className="text-muted">
                                +
                              </span>
                              <span className="sr-only">
                                Available as a paid add-on
                              </span>
                            </>
                          ) : (
                            <>
                              <span aria-hidden className="text-faint">
                                &ndash;
                              </span>
                              <span className="sr-only">Not included</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[12px] text-muted">
        <span aria-hidden>&#9679;</span> included &middot;{" "}
        <span aria-hidden>+</span> paid add-on &middot;{" "}
        <span aria-hidden>&ndash;</span> not included. Microsoft changes what is
        in a plan from time to time; their own comparison is the authority.
      </p>
    </section>
  );
}
