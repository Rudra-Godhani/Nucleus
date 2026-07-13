"use client";

// 'use client': a draggable. It needs dnd-kit's sortable hook and the transform it
// hands back on every pointer move.

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "@/components/shared/avatar";
import { Identifier } from "@/components/shared/identifier";
import { PriorityIcon, priorityLabel } from "@/components/shared/status";
import { LabelChip } from "@/components/issue/label-chip";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/data/issues";

/**
 * One card on the board.
 *
 * Two gestures live on the same element and must not fight: dragging it, and
 * clicking through to the issue. dnd-kit distinguishes them by distance — a pointer
 * that moves less than the activation threshold is a click and the link fires
 * normally; past it, dragging starts and the browser's own text-selection and
 * navigation are suppressed. So this is a real <Link>, keyboard-focusable and
 * middle-clickable, that also happens to be draggable.
 */
export function BoardCard({ issue, slug }: { issue: Issue; slug: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        // CSS.Transform, not Translate: it emits translate3d, which keeps the card on
        // the compositor instead of repainting the column on every pointer move.
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "touch-none",
        // The card being dragged is left behind as a hole. The thing under the
        // cursor is the DragOverlay, drawn once at the top of the tree, so it is not
        // clipped by the column's scroll box.
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <Link
        href={`/w/${slug}/p/${issue.projectKey}/${issue.number}`}
        className={cn(
          "border-border bg-card hover:border-border-strong block space-y-2 rounded-lg border p-2.5",
          "transition-colors duration-150",
          "focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <p className="line-clamp-2 text-sm leading-snug">{issue.title}</p>

        <div className="flex items-center gap-1.5">
          <PriorityIcon priority={issue.priority} className="size-3.5" />
          <span className="sr-only">{priorityLabel(issue.priority)}</span>

          <Identifier className="text-muted-foreground text-[11px]">
            {issue.identifier}
          </Identifier>

          <span className="flex-1" />

          {issue.assignee ? <Avatar name={issue.assignee.displayName} className="size-5" /> : null}
        </div>

        {issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * The card under the cursor while dragging.
 *
 * A separate, plainer component on purpose: it is rendered inside dnd-kit's
 * DragOverlay, where it must not be a link (there is nothing to click) and must not
 * be sortable (it is not in a list). Reusing BoardCard here would register a second
 * sortable with the same id, and dnd-kit would have two candidates for every drop.
 */
export function BoardCardOverlay({ issue }: { issue: Issue }) {
  return (
    <div className="border-border-strong bg-card w-64 space-y-2 rounded-lg border p-2.5 shadow-lg">
      <p className="line-clamp-2 text-sm leading-snug">{issue.title}</p>

      <div className="flex items-center gap-1.5">
        <PriorityIcon priority={issue.priority} className="size-3.5" />
        <Identifier className="text-muted-foreground text-[11px]">{issue.identifier}</Identifier>
        <span className="flex-1" />
        {issue.assignee ? <Avatar name={issue.assignee.displayName} className="size-5" /> : null}
      </div>

      {issue.labels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {issue.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
