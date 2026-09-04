"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  bulkSetPublished,
  clearVariantPrice,
  createProduct,
  deleteProduct,
  deleteVariant,
  saveProductDetails,
  saveVariant,
  setQuoteOnly,
  setVariantPrice,
  type AdminResult,
} from "@/app/admin/admin-actions";

/**
 * The forms that edit the catalogue.
 *
 * Separate from `admin-forms.tsx`, which holds the controls that flip one flag
 * or record one payment. These write copy, prices and structure, so they carry
 * more explanation per field than a button ever needs — the note under an
 * input is where somebody learns that a slug is an address and that withdrawn
 * is not deleted.
 */

type Option = { id: string; name: string };

function Outcome({ result }: { result: AdminResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`rounded-md border px-3 py-2 text-[13px] ${
        result.ok
          ? "border-ok/40 bg-ok/5 text-ok"
          : "border-deal/40 bg-deal/5 text-deal"
      }`}
    >
      {result.message}
    </p>
  );
}

function Go({
  label,
  busy,
  tone = "quiet",
  name,
  value,
}: {
  label: string;
  busy: string;
  tone?: "quiet" | "loud" | "danger";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const base = "rounded-full px-4 py-1.5 text-[13px] font-semibold disabled:opacity-60";
  const skin =
    tone === "loud"
      ? "btn-amber px-5 py-2 text-[14px]"
      : tone === "danger"
        ? "border border-deal/50 bg-deal/5 text-deal hover:bg-deal/10"
        : "border border-line bg-surface text-link hover:bg-ground/60";
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${base} ${skin}`}>
      {pending ? busy : label}
    </button>
  );
}

const field =
  "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[14px]";
const label = "block text-[13px] font-semibold text-ink";
const hint = "mt-1 block text-[12px] text-faint";

// ---------------------------------------------------------------------------

export function ProductDetailsForm({
  product,
  brands,
  categories,
  terms,
  specsText,
}: {
  product: {
    id: string;
    name: string;
    slug: string;
    summary: string;
    bullets: string[];
    brandId: string;
    categoryId: string;
    term: string;
    logo: string | null;
    cspNewTenant: boolean;
    featured: boolean;
  };
  brands: Option[];
  categories: Option[];
  terms: { value: string; label: string }[];
  specsText: string;
}) {
  const [result, run] = useActionState<AdminResult, FormData>(saveProductDetails, null);

  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="productId" value={product.id} />

      <label className="block">
        <span className={label}>Name</span>
        <input name="name" defaultValue={product.name} required className={field} />
      </label>

      <label className="block">
        <span className={label}>Web address</span>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[13px] text-faint">/product/</span>
          <input
            name="slug"
            defaultValue={product.slug}
            className="w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-[13px]"
          />
        </div>
        <span className={hint}>
          Changing this moves the page. The old address stops working straight
          away, and Google takes a while to find the new one — so change it to
          fix a mistake, not to tidy.
        </span>
      </label>

      <label className="block">
        <span className={label}>Summary</span>
        <textarea
          name="summary"
          defaultValue={product.summary}
          rows={2}
          required
          className={field}
        />
        <span className={hint}>
          The sentence under the title, and the sentence Google shows under the
          link. One line, no full-stop needed at the end.
        </span>
      </label>

      <label className="block">
        <span className={label}>What you get</span>
        <textarea
          name="bullets"
          defaultValue={product.bullets.join("\n")}
          rows={5}
          className={field}
        />
        <span className={hint}>One bullet per line. Blank lines are ignored.</span>
      </label>

      <label className="block">
        <span className={label}>Licence details table</span>
        <textarea
          name="specs"
          defaultValue={specsText}
          rows={6}
          className={`${field} font-mono text-[13px]`}
        />
        <span className={hint}>
          One row per line, written as <code>Label: value</code> — for example{" "}
          <code>Term: 12 months</code>. They appear in this order.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Publisher</span>
          <select name="brandId" defaultValue={product.brandId} className={field}>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Shelf</span>
          <select name="categoryId" defaultValue={product.categoryId} className={field}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Licence term</span>
          <select name="term" defaultValue={product.term} className={field}>
            {terms.map((term) => (
              <option key={term.value} value={term.value}>
                {term.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={label}>Picture</span>
        <input
          name="logo"
          defaultValue={product.logo ?? ""}
          placeholder="/logos/adobe/photoshop.svg"
          className={`${field} font-mono text-[13px]`}
        />
        <span className={hint}>
          A path inside this site. Leave it empty and the listing shows the
          drawn placeholder instead.
        </span>
      </label>

      <div className="space-y-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="cspNewTenant"
            defaultChecked={product.cspNewTenant}
            className="mt-1"
          />
          <span className="text-[13px] text-ink">
            A new Microsoft tenant is created for this order
            <span className="block text-[12px] text-faint">
              Says so on the page, in the basket and at checkout. Only true for
              Microsoft CSP subscriptions — saying it where it is not true sells
              somebody the wrong thing.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product.featured}
            className="mt-1"
          />
          <span className="text-[13px] text-ink">
            Show on the home page
            <span className="block text-[12px] text-faint">
              Only listings that are on sale appear there, however this is set.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Go label="Save the listing" busy="Saving…" tone="loud" />
      </div>
      <Outcome result={result} />
    </form>
  );
}

// ---------------------------------------------------------------------------

export function VariantForm({
  productId,
  variant,
}: {
  productId: string;
  variant?: {
    id: string;
    sku: string;
    partNumber: string | null;
    name: string;
    seats: number;
  };
}) {
  const [result, run] = useActionState<AdminResult, FormData>(saveVariant, null);
  const editing = Boolean(variant);

  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      {variant ? <input type="hidden" name="variantId" value={variant.id} /> : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_5rem]">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
            Our SKU
          </span>
          <input
            name="sku"
            defaultValue={variant?.sku ?? ""}
            required
            placeholder="MS-CFQ…"
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 font-mono text-[13px]"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
            Publisher&apos;s number
          </span>
          <input
            name="partNumber"
            defaultValue={variant?.partNumber ?? ""}
            placeholder="optional"
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 font-mono text-[13px]"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
            What this line is
          </span>
          <input
            name="name"
            defaultValue={variant?.name ?? "1 licence, 1 year"}
            required
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 text-[13px]"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
            Seats
          </span>
          <input
            name="seats"
            type="number"
            min={1}
            defaultValue={variant?.seats ?? 1}
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 text-right font-mono text-[13px] tabular-nums"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Go label={editing ? "Save this line" : "Add the line"} busy="Saving…" />
        {result ? (
          <span
            role="status"
            className={`text-[12px] ${result.ok ? "text-ok" : "text-deal"}`}
          >
            {result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function DeleteVariantForm({ variantId, sku }: { variantId: string; sku: string }) {
  const [result, run] = useActionState<AdminResult, FormData>(deleteVariant, null);
  return (
    <form action={run} className="space-y-1">
      <input type="hidden" name="variantId" value={variantId} />
      <Go label={`Remove ${sku}`} busy="Removing…" tone="danger" />
      <Outcome result={result} />
    </form>
  );
}

/**
 * Adding the price a variant does not yet have in one of the two markets.
 *
 * `PriceForm` in `admin-forms.tsx` edits a row that exists. This one creates
 * it — and it is the more important of the two, because a variant with no row
 * in a currency is not sold in that market at all and nothing on the
 * storefront says why.
 */
export function AddPriceForm({
  variantId,
  currency,
}: {
  variantId: string;
  currency: string;
}) {
  const [result, run] = useActionState<AdminResult, FormData>(setVariantPrice, null);
  return (
    <form action={run} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="currency" value={currency} />
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
          {currency} price
        </span>
        <input
          name="price"
          required
          inputMode="decimal"
          placeholder="0.00"
          className="mt-0.5 w-28 rounded-md border border-deal/50 bg-white px-2 py-1 text-right font-mono text-[13px] tabular-nums"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
          List
        </span>
        <input
          name="list"
          inputMode="decimal"
          placeholder="same"
          className="mt-0.5 w-28 rounded-md border border-line bg-white px-2 py-1 text-right font-mono text-[13px] tabular-nums"
        />
      </label>
      <Go label="Put on sale" busy="Saving…" />
      {result ? (
        <span role="status" className={`text-[12px] ${result.ok ? "text-ok" : "text-deal"}`}>
          {result.message}
        </span>
      ) : null}
    </form>
  );
}

export function ClearPriceForm({ priceId, currency }: { priceId: string; currency: string }) {
  const [result, run] = useActionState<AdminResult, FormData>(clearVariantPrice, null);
  return (
    <form action={run} className="mt-1">
      <input type="hidden" name="priceId" value={priceId} />
      <button
        type="submit"
        className="text-[12px] text-deal underline decoration-dotted hover:no-underline"
      >
        Stop selling this in {currency}
      </button>
      {result ? (
        <span role="status" className={`ml-2 text-[12px] ${result.ok ? "text-ok" : "text-deal"}`}>
          {result.message}
        </span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------

export function QuoteOnlyForm({
  productId,
  quoteOnly,
  priceCount,
}: {
  productId: string;
  quoteOnly: boolean;
  priceCount: number;
}) {
  const [result, run] = useActionState<AdminResult, FormData>(setQuoteOnly, null);

  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quoteOnly" value={quoteOnly ? "false" : "true"} />
      {!quoteOnly && priceCount > 0 ? (
        <label className="flex items-start gap-2 text-[13px] text-deal">
          <input type="checkbox" name="confirmPrices" className="mt-1" />
          <span>
            Yes, delete the {priceCount} {priceCount === 1 ? "price" : "prices"} on
            this listing. A quoted listing holds none, and this cannot be undone.
          </span>
        </label>
      ) : null}
      <Go
        label={quoteOnly ? "Sell it at a published price" : "Quote it per order instead"}
        busy="Saving…"
        tone={quoteOnly ? "quiet" : "danger"}
      />
      <Outcome result={result} />
    </form>
  );
}

/**
 * Deleting a listing, with its name typed out.
 *
 * The action refuses anything that has ever been sold, so the worst this can
 * do is remove something nobody ever bought — but it is still the only
 * irreversible control in the back office, and it sits among reversible ones.
 * Typing the name is what separates it from a misclick.
 */
export function DeleteProductForm({ productId, name }: { productId: string; name: string }) {
  const [result, run] = useActionState<AdminResult, FormData>(deleteProduct, null);
  const [typed, setTyped] = useState("");

  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="block">
        <span className="block text-[13px] font-semibold text-deal">
          Delete this listing for good
        </span>
        <span className="mt-1 block text-[12px] text-muted">
          Only possible if it has never been sold. Withdrawing does everything
          this does and keeps the history — prefer it. Type{" "}
          <strong className="font-semibold text-ink">{name}</strong> to confirm.
        </span>
        <input
          name="confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          className="mt-2 w-full max-w-md rounded-md border border-deal/40 bg-white px-3 py-2 text-[14px]"
        />
      </label>
      <button
        type="submit"
        disabled={typed !== name}
        className="rounded-full border border-deal/50 bg-deal/5 px-4 py-1.5 text-[13px] font-semibold text-deal hover:bg-deal/10 disabled:opacity-40"
      >
        Delete permanently
      </button>
      <Outcome result={result} />
    </form>
  );
}

/**
 * Selecting many listings and doing one thing to all of them.
 *
 * The rows are rendered on the server and passed in, so the list stays a
 * server component — this only owns the checkboxes around it. Two submit
 * buttons in one form, distinguished by the value they carry, because the
 * choice is which of two things to do to the same selection.
 */
export function BulkPublishForm({ children }: { children: React.ReactNode }) {
  const [result, run] = useActionState<AdminResult, FormData>(bulkSetPublished, null);
  const [count, setCount] = useState(0);

  return (
    <form
      action={run}
      onChange={(event) => {
        const form = event.currentTarget;
        setCount(
          form.querySelectorAll<HTMLInputElement>(
            'input[name="productIds"]:checked',
          ).length,
        );
      }}
    >
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/95 px-3 py-2 backdrop-blur">
        <span className="text-[13px] font-semibold text-ink">
          {count === 0
            ? "Tick listings to change several at once"
            : `${count} selected`}
        </span>
        <Go label="Put back on sale" busy="Saving…" name="published" value="true" />
        <Go label="Withdraw from sale" busy="Saving…" name="published" value="false" />
        {result ? (
          <span
            role="status"
            className={`text-[13px] ${result.ok ? "text-ok" : "text-deal"}`}
          >
            {result.message}
          </span>
        ) : null}
      </div>
      {children}
    </form>
  );
}

// ---------------------------------------------------------------------------

export function NewProductForm({
  brands,
  categories,
  terms,
}: {
  brands: Option[];
  categories: Option[];
  terms: { value: string; label: string }[];
}) {
  const [result, run] = useActionState<AdminResult, FormData>(createProduct, null);

  return (
    <form action={run} className="space-y-4">
      <label className="block">
        <span className={label}>Name</span>
        <input name="name" required className={field} placeholder="Microsoft 365 Business Standard" />
      </label>

      <label className="block">
        <span className={label}>Web address</span>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[13px] text-faint">/product/</span>
          <input
            name="slug"
            className="w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-[13px]"
            placeholder="left empty, it is made from the name"
          />
        </div>
      </label>

      <label className="block">
        <span className={label}>Summary</span>
        <textarea name="summary" rows={2} required className={field} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Publisher</span>
          <select name="brandId" className={field}>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Shelf</span>
          <select name="categoryId" className={field}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Licence term</span>
          <select name="term" className={field}>
            {terms.map((term) => (
              <option key={term.value} value={term.value}>
                {term.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="rounded-md border border-line bg-ground/30 p-3">
        <legend className="px-1 text-[13px] font-semibold text-ink">
          The first thing it sells
        </legend>
        <p className="text-[12px] text-faint">
          Every listing needs at least one buyable line. You can add more, and
          set the prices, on the next screen.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_5rem]">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
              Our SKU
            </span>
            <input
              name="sku"
              required
              placeholder="MS-…"
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 font-mono text-[13px]"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
              Publisher&apos;s number
            </span>
            <input
              name="partNumber"
              placeholder="optional"
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 font-mono text-[13px]"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
              What this line is
            </span>
            <input
              name="variantName"
              defaultValue="1 licence, 1 year"
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
              Seats
            </span>
            <input
              name="seats"
              type="number"
              min={1}
              defaultValue={1}
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1 text-right font-mono text-[13px] tabular-nums"
            />
          </label>
        </div>
      </fieldset>

      <label className="flex items-start gap-2">
        <input type="checkbox" name="quoteOnly" className="mt-1" />
        <span className="text-[13px] text-ink">
          Quote this one per order
          <span className="block text-[12px] text-faint">
            For a publisher whose price book we do not hold. It holds no price,
            and every page sends the customer to the enquiry form instead.
          </span>
        </span>
      </label>

      <p className="rounded-md border border-line bg-ground/40 px-3 py-2 text-[13px] text-muted">
        It is created <strong className="text-ink">withdrawn</strong>. Nobody
        sees it until you put it on sale, which gives you time to write the copy
        and set the prices.
      </p>

      <Go label="Create the listing" busy="Creating…" tone="loud" />
      <Outcome result={result} />
    </form>
  );
}
