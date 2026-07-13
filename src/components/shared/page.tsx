import { cn } from "@/lib/utils";

/**
 * Page furniture: the shells every screen is assembled from.
 *
 * These exist so that spacing and heading hierarchy are decided once. If each
 * page picks its own `py-` and heading size, the app drifts within a week and no
 * amount of tidying brings it back.
 */

/** The content column. `size` sets the measure, not an arbitrary max-width. */
export function PageShell({
  children,
  size = "default",
  className,
}: {
  children: React.ReactNode;
  /** narrow: forms · default: lists and detail · wide: boards */
  size?: "narrow" | "default" | "wide";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 py-10 sm:px-8 sm:py-14",
        size === "narrow" && "max-w-lg",
        size === "default" && "max-w-3xl",
        size === "wide" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The title block. `actions` sits opposite the title and collapses beneath it on
 * small screens rather than squeezing the heading into two words per line.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A titled group within a page. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title ? (
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-medium tracking-tight">{title}</h2>
            {description ? (
              <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
