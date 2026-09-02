import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";

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
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
