/**
 * A star rating, drawn as a single clipped bar rather than five glyphs, so a
 * 4.3 looks like a 4.3 instead of rounding to the nearest half.
 */
export function Stars({
  value,
  size = 14,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;

  return (
    <span
      className={`relative inline-block leading-none align-middle ${className}`}
      style={{ width: size * 5 + 2, height: size }}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <span className="absolute inset-0 flex text-line" aria-hidden="true">
        <StarRow size={size} />
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden text-star"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      >
        <StarRow size={size} />
      </span>
    </span>
  );
}

function StarRow({ size }: { size: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <svg
          key={index}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill="currentColor"
          className="shrink-0"
        >
          <path d="M10 1.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L10 14.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" />
        </svg>
      ))}
    </>
  );
}
