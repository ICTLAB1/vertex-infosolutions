import type { Metadata } from "next";
import Link from "next/link";

import { NewProductForm } from "@/components/admin-catalogue-forms";
import { requireAdmin } from "@/lib/admin";
import { TERM_LABELS } from "@/lib/catalogue";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Add a listing" };

export default async function NewProductPage() {
  await requireAdmin("/admin/catalogue/new");

  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6">
      <p className="text-[13px]">
        <Link href="/admin/catalogue" className="text-link hover:underline">
          ← All listings
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Add a listing</h1>
      <p className="mt-1 text-[14px] text-muted">
        For something the price books do not carry. Everything seeded from a
        publisher&apos;s price book is rewritten when that book is reimported,
        so a listing added here keeps its own copy only while its SKU is not in
        one.
      </p>

      <section className="mt-5 rounded-lg border border-line bg-surface p-5">
        <NewProductForm
          brands={brands}
          categories={categories}
          terms={Object.entries(TERM_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </section>
    </div>
  );
}
