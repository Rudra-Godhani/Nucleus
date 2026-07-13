import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { CommentItem } from "@/components/issue/comment-thread";
import { CommentForm } from "@/components/issue/comment-form";
import type { Comment } from "@/lib/data/comments";
import type { ActivityEvent } from "@/lib/data/activity";

/**
 * The issue's history and its conversation, in one column.
 *
 * Not two tabs, and not two stacked lists. "Ada moved this to In Progress" and "Ada
 * said: this is blocked on the API" are the same story told in the same order, and
 * splitting them makes the reader reconstruct the sequence by comparing timestamps
 * across a divider. Interleaved, the issue reads top to bottom like the account of
 * what happened that it actually is.
 *
 * Activity entries are deliberately quiet — one muted line, no card — so the
 * conversation stays the thing you see and the history is the thing you can follow.
 *
 * A Server Component: it renders data and owns no state. The composer and the
 * per-comment controls beneath it are the client parts.
 */

type TimelineEntry =
  | { kind: "comment"; at: string; comment: Comment }
  | { kind: "event"; at: string; event: ActivityEvent };

export function IssueTimeline({
  comments,
  activity,
  workspaceId,
  issueId,
  slug,
  projectKey,
  number,
  currentUserName,
}: {
  comments: Comment[];
  activity: ActivityEvent[];
  workspaceId: string;
  issueId: string;
  slug: string;
  projectKey: string;
  number: number;
  currentUserName: string;
}) {
  const entries: TimelineEntry[] = [
    ...comments.map((comment) => ({
      kind: "comment" as const,
      at: comment.createdAt,
      comment,
    })),
    ...activity.map((event) => ({ kind: "event" as const, at: event.createdAt, event })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const context = { workspaceId, issueId, slug, projectKey, number, currentUserName };

  return (
    <section aria-label="Activity" className="space-y-6">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="text-muted-foreground size-3.5" aria-hidden="true" />
        Activity
      </h2>

      {entries.length > 0 ? (
        <ul className="space-y-4">
          {entries.map((entry) =>
            entry.kind === "comment" ? (
              <CommentItem key={entry.comment.id} comment={entry.comment} context={context} />
            ) : (
              <ActivityLine key={entry.event.id} event={entry.event} />
            ),
          )}
        </ul>
      ) : null}

      {/* The composer sits at the BOTTOM, after the history — which is where the
          conversation has got to, and therefore where you are about to add to it. */}
      <CommentForm
        workspaceId={workspaceId}
        issueId={issueId}
        slug={slug}
        projectKey={projectKey}
        number={number}
        authorName={currentUserName}
      />
    </section>
  );
}

function ActivityLine({ event }: { event: ActivityEvent }) {
  return (
    // `gap-3` and a `w-7` first column, exactly like a comment: the avatars line up
    // into a single spine down the page. Give the marker its own column beside the
    // avatar and there are two ragged edges instead of one straight one.
    <li className="text-muted-foreground flex items-center gap-3 text-xs">
      <span className="flex w-7 shrink-0 justify-center">
        {event.actor ? (
          <Avatar name={event.actor} className="size-5 text-[8px]" />
        ) : (
          // Nobody signed in did this — a migration, or a trigger acting on its own.
          // A dot rather than a fake avatar: inventing a face for "the system" would
          // be a small lie in a feed whose whole value is that it does not tell them.
          <span className="bg-border size-1.5 rounded-full" aria-hidden="true" />
        )}
      </span>

      <span className="min-w-0">
        <span className="text-foreground font-medium">{event.actor ?? "Someone"}</span>{" "}
        {event.summary}
      </span>

      <RelativeTime iso={event.createdAt} className="shrink-0" />
    </li>
  );
}
