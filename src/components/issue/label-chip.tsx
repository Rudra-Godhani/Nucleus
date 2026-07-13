import { cn } from "@/lib/utils";
import type { Label } from "@/lib/data/labels";

/**
 * A label, drawn as a dot plus its name.
 *
 * The user-chosen colour is confined to the dot and never used as a background or
 * as text. That is not a stylistic preference: a label's colour is picked from a
 * palette by whoever created it, so nothing guarantees it contrasts with the page —
 * and it changes with the theme. A 6px dot beside foreground-coloured text is
 * legible whatever colour lands in it.
 */
export function LabelChip({ label, className }: { label: Label; className?: string }) {
  return (
    <span
      className={cn(
        "border-border bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-1.5 text-[11px] leading-none whitespace-nowrap",
        className,
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
        aria-hidden="true"
      />
      {label.name}
    </span>
  );
}

/** A bare colour dot, for the compact places a full chip will not fit. */
export function LabelDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}
