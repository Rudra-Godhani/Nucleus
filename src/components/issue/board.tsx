"use client";

// 'use client': drag-and-drop is a pointer interaction, the optimistic move is
// client state, and the live channel is a websocket subscription.

import { useEffect, useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ISSUE_STATUSES, StatusIcon, statusLabel } from "@/components/shared/status";
import { BoardCard, BoardCardOverlay } from "@/components/issue/board-card";
import { subscribeToBoard } from "@/lib/realtime/board";
import { moveIssueAction } from "@/app/(app)/w/[slug]/issues-actions";
import { cn } from "@/lib/utils";
import type { Issue, IssueStatus } from "@/lib/data/issues";

/**
 * The board.
 *
 * Every column is a droppable and every card is a sortable, so a card can be dropped
 * on another card (to land in a specific place) or on the column's empty space (to
 * land at the end). Both are the same operation underneath: pick a status, pick a
 * position.
 */

/**
 * Column droppable ids are namespaced so they cannot collide with an issue id. Both
 * arrive as `over.id` in the same drag handler, and telling them apart by "is it a
 * uuid" would be a guess.
 */
const COLUMN_PREFIX = "column:";

type Move = { id: string; status: IssueStatus; position: number };

/**
 * The gap to leave when a card lands at the top or bottom of a column.
 *
 * Positions are epoch seconds (see the issue_position_default migration), so a whole
 * unit is a second and there is no risk of colliding with a neighbour.
 */
const EDGE_GAP = 1;

/**
 * Where a card lands, given the cards it is being dropped between.
 *
 * The midpoint of its neighbours. This is the entire ordering scheme: one number, one
 * row written, no renumbering of the cards below it and no race with anyone else
 * dragging in the same column at the same time.
 */
function positionBetween(before: Issue | undefined, after: Issue | undefined): number {
  if (!before && !after) return 0;
  if (!before) return after!.position - EDGE_GAP;
  if (!after) return before.position + EDGE_GAP;
  return (before.position + after.position) / 2;
}

/** The order the server returns issues in. Kept identical, so an optimistic move
 *  settles into exactly the place the refetch will put it. */
function byBoardOrder(a: Issue, b: Issue): number {
  if (a.position !== b.position) return a.position - b.position;
  return b.created_at.localeCompare(a.created_at);
}

export function Board({
  issues,
  slug,
  projectKey,
  projectId,
}: {
  issues: Issue[];
  slug: string;
  projectKey: string;
  projectId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<Issue | null>(null);

  /**
   * The move that has been made but not yet confirmed.
   *
   * useOptimistic, not useState: the optimistic value is discarded automatically when
   * the transition that produced it finishes, and `issues` — freshly re-fetched from
   * the server — takes over. Held in useState it would need an effect to reconcile the
   * two, which is both a cascading render and the exact bug where a card briefly
   * snaps back to its old column before jumping to its new one.
   */
  const [optimisticIssues, applyMove] = useOptimistic(issues, (current, move: Move) =>
    current.map((issue) =>
      issue.id === move.id
        ? { ...issue, status: move.status, position: move.position }
        : issue,
    ),
  );

  /**
   * Somebody else moved something. Re-fetch rather than patch the payload in.
   *
   * router.refresh() re-runs the Server Component, so the board is rebuilt by the
   * same code that built it on first load. Applying the broadcast payload here
   * instead would mean a second implementation of "how an issue becomes a card"
   * living in the browser, free to drift from the real one.
   */
  useEffect(() => {
    return subscribeToBoard(projectId, () => router.refresh());
  }, [projectId, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A card is also a link. Without a distance threshold, the click that opens an
      // issue would be swallowed by a zero-length drag, and the board would be
      // navigable only by accident.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = ISSUE_STATUSES.map((status) => ({
    status,
    issues: optimisticIssues.filter((issue) => issue.status === status).sort(byBoardOrder),
  }));

  function handleDragStart(event: DragStartEvent) {
    setDragging(optimisticIssues.find((issue) => issue.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    if (!over) return;

    const issue = optimisticIssues.find((candidate) => candidate.id === active.id);
    if (!issue) return;

    const overId = String(over.id);

    // Dropped on a column's empty space, or on a card in it.
    const targetStatus = overId.startsWith(COLUMN_PREFIX)
      ? (overId.slice(COLUMN_PREFIX.length) as IssueStatus)
      : optimisticIssues.find((candidate) => candidate.id === overId)?.status;

    if (!targetStatus) return;

    // The column as it will look with this card taken out of it — which is what the
    // new neighbours have to be computed against, or a card dragged downward within
    // its own column would be measured against its own old self.
    const column = columns
      .find((c) => c.status === targetStatus)!
      .issues.filter((candidate) => candidate.id !== issue.id);

    let index: number;

    if (overId.startsWith(COLUMN_PREFIX)) {
      // Empty space below the cards: the end of the column.
      index = column.length;
    } else {
      const overIndex = column.findIndex((candidate) => candidate.id === overId);
      if (overIndex === -1) return;

      // Dropping ON a card is ambiguous: above it, or below it? dnd-kit gives the
      // dragged card's live rectangle, so ask where its centre actually is relative
      // to the card underneath. Without this, a card can never be dropped below the
      // one it is hovering, and the bottom of a column becomes unreachable.
      const draggedRect = active.rect.current.translated;
      const below =
        draggedRect !== null &&
        draggedRect.top + draggedRect.height / 2 > over.rect.top + over.rect.height / 2;

      index = below ? overIndex + 1 : overIndex;
    }

    const position = positionBetween(column[index - 1], column[index]);

    // Nothing actually changed — a card picked up and put back down. Writing anyway
    // would broadcast a pointless UPDATE to every other board.
    if (issue.status === targetStatus && issue.position === position) return;

    startTransition(async () => {
      applyMove({ id: issue.id, status: targetStatus, position });

      try {
        await moveIssueAction({
          issueId: issue.id,
          status: targetStatus,
          position,
          slug,
          projectKey,
        });
      } catch {
        // The optimistic move is already gone — the transition ended. All that is
        // left is to say so, and to make sure the board on screen is the board in
        // the database rather than whatever the failed drag left behind.
        toast.error("That move could not be saved.");
        router.refresh();
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      // closestCorners, not closestCenter: with columns of differing heights, centre
      // distance makes a short column's cards win drops aimed at a tall neighbour.
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {/*
        Five equal columns that fit a laptop without scrolling, and scroll rather
        than crush below about 1000px. The minimum is what stops a column collapsing
        to the width of its own title; the 1fr is what makes them share the space
        evenly when there is room.
      */}
      <div className="grid grid-cols-[repeat(5,minmax(11rem,1fr))] gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <BoardColumn
            key={column.status}
            status={column.status}
            issues={column.issues}
            slug={slug}
          />
        ))}
      </div>

      {/*
        The card under the cursor, drawn at the root of the tree rather than inside
        its column — so it is not clipped when dragged across a column boundary.
      */}
      <DragOverlay>{dragging ? <BoardCardOverlay issue={dragging} /> : null}</DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  issues,
  slug,
}: {
  status: IssueStatus;
  issues: Issue[];
  slug: string;
}) {
  // The whole column is a drop target, not just the cards in it — otherwise an empty
  // column could never receive anything, which is the one thing an empty column is for.
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });

  return (
    <section aria-labelledby={`board-${status}`} className="flex min-w-0 flex-col">
      <h3
        id={`board-${status}`}
        className="mb-2 flex items-center gap-2 px-1 text-xs font-medium"
      >
        <StatusIcon status={status} />
        {statusLabel(status)}
        <span className="text-muted-foreground tabular-nums">{issues.length}</span>
      </h3>

      <div
        ref={setNodeRef}
        className={cn(
          "bg-muted/40 flex-1 rounded-xl p-1.5 transition-colors duration-150",
          // The column being dragged over lights up. Without it, a drop is a leap of
          // faith — nothing on screen says where the card is about to land.
          isOver && "bg-accent",
        )}
      >
        <SortableContext
          items={issues.map((issue) => issue.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex min-h-24 flex-col gap-1.5">
            {issues.map((issue) => (
              <BoardCard key={issue.id} issue={issue} slug={slug} />
            ))}
          </ul>
        </SortableContext>
      </div>
    </section>
  );
}
