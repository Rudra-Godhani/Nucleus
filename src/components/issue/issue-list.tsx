import Link from "next/link";
import { Avatar } from "@/components/shared/avatar";
import { Identifier } from "@/components/shared/identifier";
import { RelativeTime } from "@/components/shared/relative-time";
import {
  ISSUE_STATUSES,
  PriorityIcon,
  StatusIcon,
  priorityLabel,
  statusLabel,
} from "@/components/shared/status";
import { LabelChip } from "@/components/issue/label-chip";
import type { Issue } from "@/lib/data/issues";

/**
 * The issue list, grouped by status.
 *
 * Grouping rather than a flat table, because the first question anyone asks a
 * backlog is "what is in flight" — and a flat list makes you answer it by scanning
 * an icon column. The groups answer it before you read a single title, and each
 * carries its own count.
 *
 * Empty groups are dropped. A column of zeroes is noise; the board (next step) is
 * where an empty column is meaningful, because that is where you drop things into it.
 */
export function IssueList({ issues, slug }: { issues: Issue[]; slug: string }) {
  const groups = ISSUE_STATUSES.map((status) => ({
    status,
    issues: issues.filter((issue) => issue.status === status),
  })).filter((group) => group.issues.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.status} aria-labelledby={`group-${group.status}`}>
          <h3
            id={`group-${group.status}`}
            className="mb-2 flex items-center gap-2 px-1 text-xs font-medium"
          >
            <StatusIcon status={group.status} />
            {statusLabel(group.status)}
            <span className="text-muted-foreground tabular-nums">{group.issues.length}</span>
          </h3>

          <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
            {group.issues.map((issue) => (
              <li key={issue.id}>
                <IssueRow issue={issue} slug={slug} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function IssueRow({ issue, slug }: { issue: Issue; slug: string }) {
  return (
    <Link
      href={`/w/${slug}/p/${issue.projectKey}/${issue.number}`}
      className="hover:bg-accent/50 flex items-center gap-3 px-3 py-2.5 transition-colors duration-150"
    >
      {/*
        The icons carry a title rather than a visible label — on a row this dense
        there is no room for the word "Urgent", and the shape already says it. The
        title is what makes them legible to a screen reader and on hover.
      */}
      <PriorityIcon priority={issue.priority} />
      <span className="sr-only">{priorityLabel(issue.priority)}</span>

      <Identifier className="text-muted-foreground w-16 shrink-0 text-xs">
        {issue.identifier}
      </Identifier>

      <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>

      {/*
        Labels are the first thing to go when the row runs out of room: they are
        secondary to the title, and they are still on the issue's own page.
      */}
      {issue.labels.length > 0 ? (
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {issue.labels.slice(0, 2).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {issue.labels.length > 2 ? (
            <span className="text-muted-foreground text-[11px] tabular-nums">
              +{issue.labels.length - 2}
            </span>
          ) : null}
        </span>
      ) : null}

      {/*
        `whitespace-nowrap` and a width that fits the longest string this can produce
        ("52 seconds ago"). Without both, the date wraps onto a second line and that
        one row grows taller than its neighbours — which is instantly visible in a
        list whose whole job is to be scanned.
      */}
      <RelativeTime
        iso={issue.created_at}
        className="text-muted-foreground hidden w-28 shrink-0 text-right text-xs whitespace-nowrap sm:block"
      />

      {issue.assignee ? (
        <Avatar name={issue.assignee.displayName} className="size-6" />
      ) : (
        // A placeholder, not nothing: without it the avatar column jumps left on
        // every unassigned row and the whole list looks ragged.
        <span
          className="border-border size-6 shrink-0 rounded-full border border-dashed"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}
