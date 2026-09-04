import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { channelStatus } from "@/lib/notify";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Admin" },
  robots: { index: false, follow: false },
};

/**
 * The back office.
 *
 * Guarded here so a stray page cannot be added unguarded, and guarded again in
 * every page and every action — a layout does not run before a server action,
 * so this alone would protect what is visible and none of the writes.
 *
 * Visually separate from the storefront on purpose: a different ground colour
 * and a plain bar, so nobody demonstrating the site to a customer mistakes one
 * for the other.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const outage = await mailOutage();

  return (
    <div className="flex min-h-full flex-col bg-nav/[0.03]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-nav text-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/admin" className="text-[15px] font-bold">
            Vertex admin
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
            <Link href="/admin/orders" className="opacity-90 hover:opacity-100 hover:underline">
              Orders
            </Link>
            <Link href="/admin/customers" className="opacity-90 hover:opacity-100 hover:underline">
              Customers
            </Link>
            <Link href="/admin/enquiries" className="opacity-90 hover:opacity-100 hover:underline">
              Enquiries
            </Link>
            <Link href="/admin/messages" className="opacity-90 hover:opacity-100 hover:underline">
              Messages
            </Link>
            <Link href="/admin/catalogue" className="opacity-90 hover:opacity-100 hover:underline">
              Catalogue
            </Link>
            <Link href="/admin/activity" className="opacity-90 hover:opacity-100 hover:underline">
              Activity
            </Link>
          </nav>
          <span className="ml-auto text-[13px] opacity-75">{admin.email}</span>
          <Link href="/" className="text-[13px] underline opacity-90 hover:opacity-100">
            The store
          </Link>
        </div>
      </header>
      {/*
        The one outage nobody would otherwise notice.

        With no mail provider configured, every account that registers is told
        a code is on its way and never receives one — and since nothing can be
        bought before an address is confirmed, the shop is refusing every new
        customer without a single error appearing anywhere a person looks. It
        happened. So the back office says so on every page until it is fixed,
        and counts the messages that failed while it was true.
      */}
      {outage ? (
        <div className="border-b border-deal/40 bg-deal/10">
          <div className="mx-auto max-w-[1100px] px-4 py-3">
            <p className="text-[14px] font-bold text-deal">
              No email is being sent. Nobody can finish creating an account.
            </p>
            <p className="mt-1 text-[13px] text-deal/90">
              {outage}{" "}
              <Link href="/admin/messages" className="underline">
                See what failed
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}

/**
 * A sentence about the mail provider, or nothing.
 *
 * Two different faults look identical to a customer — no provider configured,
 * and a provider that is rejecting — so both are reported, and the count of
 * recently failed messages is included because "it is broken" and "it has been
 * broken for two hundred customers" are different sentences.
 */
async function mailOutage(): Promise<string | null> {
  if (!channelStatus().email) {
    const failed = await prisma.notification
      .count({ where: { channel: "EMAIL", status: "FAILED" } })
      .catch(() => 0);
    return `The mail service is not configured on the server: ACS_CONNECTION_STRING and EMAIL_FROM are both needed, and one or both is missing.${
      failed > 0
        ? ` ${failed} ${failed === 1 ? "message has" : "messages have"} failed to send so far.`
        : ""
    }`;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failed = await prisma.notification
    .count({ where: { channel: "EMAIL", status: "FAILED", createdAt: { gt: since } } })
    .catch(() => 0);
  if (failed === 0) return null;

  return `${failed} ${failed === 1 ? "message" : "messages"} failed to send in the last day, although the mail service is configured.`;
}
