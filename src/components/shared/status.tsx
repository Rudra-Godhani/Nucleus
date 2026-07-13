import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database.types";

type IssueStatus = Database["public"]["Enums"]["issue_status"];
type IssuePriority = Database["public"]["Enums"]["issue_priority"];

/**
 * Status, drawn as a progress ring rather than a coloured dot.
 *
 * A dot only carries meaning once you have learned the colour key. A ring that
 * fills as work advances — empty for backlog, quarter, half, complete — is
 * legible before you have learned anything, and still legible to someone who
 * cannot distinguish the colours at all. Colour is the second channel here, not
 * the only one.
 *
 * Drawn with stroke-dasharray on a circle so a single component covers every
 * state and there are no icon assets to keep in sync.
 */

const STATUS_META: Record<
  IssueStatus,
  { label: string; className: string; fraction: number }
> = {
  backlog: { label: "Backlog", className: "text-status-backlog", fraction: 0 },
  todo: { label: "Todo", className: "text-status-todo", fraction: 0 },
  in_progress: { label: "In Progress", className: "text-status-progress", fraction: 0.5 },
  done: { label: "Done", className: "text-status-done", fraction: 1 },
  canceled: { label: "Canceled", className: "text-status-canceled", fraction: 1 },
};

export function statusLabel(status: IssueStatus): string {
  return STATUS_META[status].label;
}

export function StatusIcon({
  status,
  className,
}: {
  status: IssueStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];

  // r=5 gives a 10px ring inside a 16px box: dense enough for a list row, still
  // readable. Circumference drives the dash so the fill is exact, not eyeballed.
  const radius = 5;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-4 shrink-0", meta.className, className)}
      aria-hidden="true"
    >
      {/* Backlog is the only dashed ring — it reads as "not yet real". */}
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity={status === "backlog" ? 0.55 : 1}
        strokeDasharray={status === "backlog" ? "1.5 2" : undefined}
      />

      {meta.fraction > 0 && meta.fraction < 1 ? (
        <circle
          cx="8"
          cy="8"
          r={radius / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={radius}
          strokeDasharray={`${(circumference / 2) * meta.fraction} ${circumference}`}
          // Start the fill at 12 o'clock, not 3 o'clock.
          transform="rotate(-90 8 8)"
        />
      ) : null}

      {status === "done" ? (
        <path
          d="M5.5 8.2 7.1 9.8 10.5 6.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {status === "canceled" ? (
        <path
          d="M6 6l4 4M10 6l-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

/**
 * Priority, drawn as signal bars.
 *
 * Deliberately monochrome except at urgent. If priority competed with status for
 * colour, a board would read as noise — status is the headline, priority is a
 * whisper you only hear when you look for it.
 */
const PRIORITY_META: Record<IssuePriority, { label: string; bars: number; className: string }> =
  {
    none: { label: "No priority", bars: 0, className: "text-muted-foreground/50" },
    low: { label: "Low", bars: 1, className: "text-priority-low" },
    medium: { label: "Medium", bars: 2, className: "text-priority-medium" },
    high: { label: "High", bars: 3, className: "text-priority-high" },
    urgent: { label: "Urgent", bars: 3, className: "text-priority-urgent" },
  };

export function priorityLabel(priority: IssuePriority): string {
  return PRIORITY_META[priority].label;
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: IssuePriority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];

  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-4 shrink-0", meta.className, className)}
      aria-hidden="true"
    >
      {priority === "urgent" ? (
        // Urgent breaks the pattern on purpose. A fourth bar would just be
        // "high, but more"; a filled marker is a different kind of thing, and
        // that is exactly what urgent is.
        <>
          <rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor" />
          <path
            d="M8 4.75v4"
            stroke="var(--background)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.1" r="0.95" fill="var(--background)" />
        </>
      ) : (
        [0, 1, 2].map((i) => (
          <rect
            key={i}
            x={2.5 + i * 4}
            y={11 - i * 3}
            width="2.5"
            height={3 + i * 3}
            rx="0.75"
            fill="currentColor"
            // Bars beyond the level stay visible but recede, so the control has
            // a stable silhouette instead of changing width as priority changes.
            fillOpacity={i < meta.bars ? 1 : 0.2}
          />
        ))
      )}
    </svg>
  );
}
