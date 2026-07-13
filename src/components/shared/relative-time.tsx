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

export function formatRelative(iso: string, locale = "en"): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;

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
