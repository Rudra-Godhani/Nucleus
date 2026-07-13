/**
 * A date rendered as "in 6 days" / "3 hours ago".
 *
 * Uses `Intl.RelativeTimeFormat` rather than a hand-rolled format, so it is
 * correct in the user's locale instead of correct in English.
 *
 * Deliberately a Server Component with an absolute `dateTime` and `title`: the
 * relative string is computed once on the server, so the server and client render
 * the same text and there is no hydration mismatch. The exact timestamp is one
 * hover away for anyone who needs it.
 */
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/**
 * Anything this close to now is reported as "now".
 *
 * Not cosmetic. `created_at` comes from Postgres's clock and `Date.now()` from
 * whatever machine renders the page, and those two are never exactly in step — so an
 * issue filed a moment ago would render as "in 1 second", a timestamp in the future,
 * which is simply wrong. A window wide enough to absorb ordinary clock skew removes
 * the whole class of nonsense, and "now" is what a human would have said anyway.
 */
const SKEW_WINDOW_SECONDS = 30;

export function formatRelative(iso: string, locale = "en"): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;

  // `numeric: "auto"` renders a zero offset as "now" rather than "in 0 seconds".
  if (Math.abs(duration) < SKEW_WINDOW_SECONDS) return formatter.format(0, "second");

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return iso;
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className}>
      {formatRelative(iso)}
    </time>
  );
}
