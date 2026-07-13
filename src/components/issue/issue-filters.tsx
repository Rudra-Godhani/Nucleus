"use client";

// 'use client': changing a filter rewrites the URL, which needs the router and the
// current search params.

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PriorityIcon,
  StatusIcon,
  priorityLabel,
  statusLabel,
} from "@/components/shared/status";
import { LabelDot } from "@/components/issue/label-chip";
import type { MemberOption } from "@/components/issue/issue-pickers";
import type { Label } from "@/lib/data/labels";

/**
 * The filter bar.
 *
 * State lives in the URL, not in this component. That is the whole point: a
 * filtered list is a thing you can bookmark, share in a message, and get back by
 * pressing Back. Held in React state it would be none of those, and it would reset
 * every time an issue was created. Saved views (Step 10) are then just stored URLs.
 *
 * The reads are done server-side — `listIssues` filters in Postgres — so this
 * component never sees an issue.
 */

/** Radix Select cannot hold an empty value, so "no filter" needs a name. */
const ANY = "any";

export function IssueFilters({
  members,
  labels,
}: {
  members: MemberOption[];
  labels: Label[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const status = params.get("status") ?? ANY;
  const priority = params.get("priority") ?? ANY;
  const assignee = params.get("assignee") ?? ANY;
  const label = params.get("label") ?? ANY;

  const active = [status, priority, assignee, label].some((value) => value !== ANY);

  function setFilter(key: string, value: string) {
    // Built from the current params rather than from scratch, so setting one filter
    // does not silently drop the others.
    const next = new URLSearchParams(params);
    if (value === ANY) next.delete(key);
    else next.set(key, value);

    const query = next.toString();
    // `scroll: false` — a filter change should not throw you back to the top of a
    // list you were halfway down.
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={status} onValueChange={(value) => setFilter("status", value)}>
        <SelectTrigger size="sm" className="bg-card w-auto min-w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          <SelectItem value={ANY}>All statuses</SelectItem>
          {ISSUE_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              <StatusIcon status={value} />
              {statusLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={priority} onValueChange={(value) => setFilter("priority", value)}>
        <SelectTrigger size="sm" className="bg-card w-auto min-w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          <SelectItem value={ANY}>Any priority</SelectItem>
          {ISSUE_PRIORITIES.map((value) => (
            <SelectItem key={value} value={value}>
              <PriorityIcon priority={value} />
              {priorityLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={assignee} onValueChange={(value) => setFilter("assignee", value)}>
        <SelectTrigger size="sm" className="bg-card w-auto min-w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          <SelectItem value={ANY}>Anyone</SelectItem>
          {/*
            "Unassigned" is a filter people reach for constantly — it is the
            question "what has nobody picked up" — so it sits above the names
            rather than being reachable only by clearing the filter.
          */}
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              <Avatar name={member.displayName} className="size-5" />
              {member.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {labels.length > 0 ? (
        <Select value={label} onValueChange={(value) => setFilter("label", value)}>
          <SelectTrigger size="sm" className="bg-card w-auto min-w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="p-1">
            <SelectItem value={ANY}>Any label</SelectItem>
            {labels.map((value) => (
              <SelectItem key={value.id} value={value.id}>
                <LabelDot color={value.color} />
                {value.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {/* Only rendered when there is something to clear, so it is never a dead control. */}
      {active ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 gap-1 px-2 text-xs"
          onClick={() => router.replace("?", { scroll: false })}
        >
          <X className="size-3" aria-hidden="true" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
