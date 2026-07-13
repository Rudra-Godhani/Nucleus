import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The empty state.
 *
 * An empty screen is the first thing a new user sees, so it is treated as a
 * designed state rather than an absence of one. It always answers two questions:
 * what belongs here, and what do I do next — which is why `action` is part of the
 * component rather than something each caller remembers to add.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="bg-muted text-muted-foreground mb-4 flex size-10 items-center justify-center rounded-lg">
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      ) : null}

      <p className="text-sm font-medium">{title}</p>

      {description ? (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed text-balance">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
