import Image from "next/image";

/**
 * The publisher authorisations this business actually holds.
 *
 * A claim about the business rather than decoration, so a badge belongs here
 * only while the certification does — and only when we hold the publisher's
 * own artwork for it. Adding one is a line in this list plus its file under
 * `public/badges/`.
 *
 * They sit on a light plate deliberately. The strip runs under a dark header
 * and the footer is darker still; these are transparent artwork with black in
 * them, and unplated they half-disappear. A partner badge that cannot be read
 * is worse than no badge.
 */
const BADGES: readonly {
  src: string;
  alt: string;
  width: number;
  height: number;
}[] = [
  {
    src: "/badges/microsoft-solutions-partner.png",
    alt: "Microsoft Solutions Partner",
    width: 819,
    height: 210,
  },
  {
    src: "/badges/adobe-certified-reseller.png",
    alt: "Adobe Certified Reseller",
    width: 1814,
    height: 788,
  },
];

export function PartnerBadges({
  className = "",
  height = 26,
}: {
  className?: string;
  /** Rendered height in pixels. Sized by height, never by width. */
  height?: number;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {BADGES.map((badge) => (
        // Every badge is a different shape — Microsoft's is nearly four times
        // as wide as it is tall, Adobe's a little over twice. Sizing by width
        // therefore made them different heights and the row looked broken.
        // Height is fixed and width follows, so the plates line up whatever
        // artwork arrives next.
        <li
          key={badge.src}
          className="flex items-center rounded-md bg-white px-2.5"
          style={{ height: height + 14 }}
        >
          <Image
            src={badge.src}
            alt={badge.alt}
            width={badge.width}
            height={badge.height}
            sizes={`${Math.round((height * badge.width) / badge.height)}px`}
            className="w-auto"
            style={{ height }}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The slim strip under the header, on every page of the shop.
 *
 * Placed at the top because it answers the question a first-time visitor asks
 * before any other — whether this is a real supplier — and because the answer
 * stops being useful once they have scrolled past the product they came for.
 */
export function PartnerStrip() {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          Authorised reseller
        </p>
        <PartnerBadges height={22} />
        <p className="text-[12px] text-muted">
          Genuine licences, supplied under the publisher&apos;s own end-user
          terms.
        </p>
      </div>
    </div>
  );
}
