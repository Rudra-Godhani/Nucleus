import type { Database } from "@/lib/types/database.types";

export type IssueStatus = Database["public"]["Enums"]["issue_status"];
export type IssuePriority = Database["public"]["Enums"]["issue_priority"];

/**
 * What an issue's statuses and priorities are CALLED, and the order they come in.
 *
 * In `lib`, not in a component, because this is domain vocabulary rather than
 * decoration. The activity feed builds sentences out of it on the server ("moved this
 * to In Progress"), and the data layer must not have to import from `components/` to
 * do so — that dependency points the wrong way, and it is the kind of thing that
 * quietly turns a UI component into a load-bearing module nobody dares delete.
 *
 * The icons stay in `components/shared/status.tsx`. Words here, pixels there.
 */

/** The order work moves through, not alphabetical. The board's columns, left to right. */
export const ISSUE_STATUSES: readonly IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
];

/** Loudest first — a priority menu is opened to escalate far more often than to calm down. */
export const ISSUE_PRIORITIES: readonly IssuePriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

const PRIORITY_LABELS: Record<IssuePriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function statusLabel(status: IssueStatus): string {
  return STATUS_LABELS[status];
}

export function priorityLabel(priority: IssuePriority): string {
  return PRIORITY_LABELS[priority];
}
