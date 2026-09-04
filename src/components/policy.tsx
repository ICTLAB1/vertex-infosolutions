import { getSiteConfig } from "@/lib/site";

/**
 * The shell every policy page uses.
 *
 * These pages are written in plain language and describe what this codebase
 * actually does — the delivery estimate really is calculated the way the
 * delivery page says, and the return rules really are the ones enforced at
 * checkout. They are drafts, not legal advice, and the banner says so until
 * somebody qualified has read them.
 */
export async function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const config = await getSiteConfig();

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8">
      <article className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">Last updated {updated}</p>

        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-4 rounded-md border border-warn/40 bg-warn/5 px-4 py-3 text-[13px] text-warn">
            <strong className="font-semibold">Draft.</strong> This text
            describes how the store behaves. It has not been reviewed by a
            lawyer, and it must be before the store takes a real order. Shown in
            development only.
          </p>
        ) : null}

        <div className="policy mt-6 space-y-5 text-[15px] leading-relaxed text-muted">
          {children}
        </div>

        <footer className="mt-8 border-t border-line-soft pt-4 text-[13px] text-muted">
          <p className="font-semibold text-ink">
            {config.legalName ?? config.tradingName}
          </p>
          {config.address ? <p>{config.address}</p> : null}
          {config.supportEmail ? (
            <p>
              <a
                href={`mailto:${config.supportEmail}`}
                className="text-link underline"
              >
                {config.supportEmail}
              </a>
              {config.supportPhone ? ` · ${config.supportPhone}` : null}
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-2 text-[19px] font-bold text-ink">{children}</h2>
  );
}

export function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-faint">{children}</ul>
  );
}
