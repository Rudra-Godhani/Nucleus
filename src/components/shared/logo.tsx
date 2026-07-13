import { cn } from "@/lib/utils";

/**
 * The mark: a nucleus. A filled core with an orbital ring around it.
 *
 * Drawn rather than imported so it inherits `currentColor` and scales to any
 * size without a second asset. The core uses the accent; the ring is the text
 * colour at low opacity, so the mark reads correctly on either theme.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        className="stroke-foreground/25"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3.75" className="fill-primary" />
      {/* The electron. Positioned on the ring, not centred — a perfectly
          symmetrical mark is a target, not a logo. */}
      <circle cx="20.2" cy="6.2" r="1.9" className="fill-foreground/45" />
    </svg>
  );
}

/** The mark plus the wordmark. Used in headers and on the auth screens. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo />
      <span className="font-display text-[1.35em] leading-none tracking-tight" translate="no">
        Nucleus
      </span>
    </span>
  );
}
