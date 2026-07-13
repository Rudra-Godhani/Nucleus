import { cn } from "@/lib/utils";

/**
 * An issue or project identifier: MA-1, PLAT-14, ACME.
 *
 * Three things have to be true of these everywhere they appear, and getting any
 * one of them wrong is easy to miss:
 *
 *  - `whitespace-nowrap`, or a line break lands on the hyphen and the identifier
 *    is split in half ("MA-" / "1"). It is one token, not two words.
 *  - `translate="no"`, or a browser's auto-translate will happily rewrite it.
 *  - `tabular-nums`, so a column of them does not jitter as the numbers change.
 *
 * Doing it once here means it cannot rot at each call site.
 */
export function Identifier({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      translate="no"
      className={cn("font-mono whitespace-nowrap tabular-nums", className)}
    >
      {children}
    </span>
  );
}
