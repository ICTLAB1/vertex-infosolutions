import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm, HandleEnquiryForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { KIND_LABELS } from "@/lib/enquiries";

import { reopenEnquiry } from "../admin-actions";

export const metadata: Metadata = { title: "Enquiries" };

const KINDS = ["VOLUME_QUOTE", "LICENSING", "GENERAL"] as const;

/**
 * Questions from people who have not bought anything yet.
 *
 * Defaults to the ones nobody has answered, newest last rather than newest
 * first: the oldest unanswered question is the one costing money, and a list
 * that puts today's at the top is a list where a three-day-old quote request
 * quietly sinks. Answering happens in a mailbox — this page only records that
 * it was answered, and what was said.
 */
export default async function AdminEnquiriesPage(
  props: PageProps<"/admin/enquiries">,
) {
  await requireAdmin("/admin/enquiries");
  const params = (await props.searchParams) as Record<string, string | undefined>;
  const showHandled = params.show === "handled";
  // Read once, before the list renders: one clock for every row, so two
  // enquiries a millisecond apart cannot be shown a day apart.
  const now = new Date();
  const kind = KINDS.find((k) => k === params.kind);

  const [enquiries, open, handled] = await Promise.all([
    prisma.enquiry.findMany({
      where: {
        handledAt: showHandled ? { not: null } : null,
        ...(kind ? { kind } : {}),
      },
      // Open enquiries oldest first — that is the queue. Handled ones newest
      // first, because that list is read as history.
      orderBy: { createdAt: showHandled ? "desc" : "asc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        name: true,
        email: true,
        company: true,
        phone: true,
        message: true,
        productSlug: true,
        currency: true,
        country: true,
        createdAt: true,
        handledAt: true,
        handledBy: true,
        handledNote: true,
      },
    }),
    prisma.enquiry.count({ where: { handledAt: null } }),
    prisma.enquiry.count({ where: { handledAt: { not: null } } }),
  ]);

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-md border px-3 py-1.5 ${
        active ? "border-ink bg-ink text-white" : "border-line bg-surface"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Enquiries</h1>
      <p className="mt-1 text-[14px] text-muted">
        Everything sent through the contact form, including every request for a
        volume quote. Reply from the support mailbox, then close it here with a
        line about what you said.
      </p>

      <nav className="mt-3 flex flex-wrap gap-2 text-[13px]">
        {tab("/admin/enquiries", `Open (${open})`, !showHandled && !kind)}
        {KINDS.map((k) =>
          tab(
            `/admin/enquiries?kind=${k}`,
            KIND_LABELS[k],
            !showHandled && kind === k,
          ),
        )}
        {tab("/admin/enquiries?show=handled", `Handled (${handled})`, showHandled)}
      </nav>

      {enquiries.length === 0 ? (
        <p className="mt-6 rounded-lg border border-line bg-surface p-6 text-center text-muted">
          {showHandled
            ? "Nothing has been closed yet."
            : "Nothing waiting. Every question has been answered."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {enquiries.map((enquiry) => {
            const ageDays = Math.floor(
              (now.getTime() - enquiry.createdAt.getTime()) / 86_400_000,
            );
            const stale = !enquiry.handledAt && ageDays >= 1;

            return (
              <li
                key={enquiry.id}
                className={`rounded-lg border bg-surface p-4 ${
                  stale ? "border-warn/40" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {enquiry.name}
                    {enquiry.company ? (
                      <span className="font-normal text-muted">
                        {" "}
                        · {enquiry.company}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[13px] text-muted">
                    <span
                      className={`mr-2 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                        enquiry.kind === "VOLUME_QUOTE"
                          ? "bg-amber/20 text-ink"
                          : "bg-nav/10 text-muted"
                      }`}
                    >
                      {KIND_LABELS[enquiry.kind]}
                    </span>
                    {enquiry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    {stale ? (
                      <span className="ml-2 font-semibold text-warn">
                        {ageDays} day{ageDays === 1 ? "" : "s"} old
                      </span>
                    ) : null}
                  </p>
                </div>

                <p className="mt-1 text-[13px] text-muted">
                  <a
                    href={`mailto:${enquiry.email}`}
                    className="text-link underline"
                  >
                    {enquiry.email}
                  </a>
                  {enquiry.phone ? ` · ${enquiry.phone}` : null}
                  {enquiry.currency
                    ? ` · quoting in ${enquiry.currency}${
                        enquiry.country ? ` (${enquiry.country})` : ""
                      }`
                    : null}
                </p>

                {enquiry.productSlug ? (
                  <p className="mt-1 text-[13px]">
                    Asking about{" "}
                    <Link
                      href={`/product/${enquiry.productSlug}`}
                      className="text-link underline"
                    >
                      {enquiry.productSlug}
                    </Link>
                  </p>
                ) : null}

                <p className="mt-2 whitespace-pre-wrap rounded-md border border-line-soft bg-ground/50 p-3 text-[14px] text-ink">
                  {enquiry.message}
                </p>

                {enquiry.handledAt ? (
                  <div className="mt-3 rounded-md border border-ok/30 bg-ok/5 p-3 text-[13px]">
                    <p className="font-semibold text-ok">
                      Closed{" "}
                      {enquiry.handledAt
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ")}
                      {enquiry.handledBy ? ` by ${enquiry.handledBy}` : null}
                    </p>
                    {enquiry.handledNote ? (
                      <p className="mt-0.5 text-muted">{enquiry.handledNote}</p>
                    ) : (
                      <p className="mt-0.5 text-faint">No note was left.</p>
                    )}
                    <div className="mt-2">
                      <ActionForm
                        action={reopenEnquiry}
                        fields={{ enquiryId: enquiry.id }}
                        label="Reopen"
                        busy="Reopening…"
                      />
                    </div>
                  </div>
                ) : (
                  <HandleEnquiryForm enquiryId={enquiry.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
