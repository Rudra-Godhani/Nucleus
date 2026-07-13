"use client";

// 'use client': these are dropdowns. They hold open/selection state and have to
// render the chosen value back into the trigger as you pick it.

import { useState } from "react";
import { Check, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label as FieldLabel } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import type { IssuePriority, IssueStatus } from "@/lib/data/issues";
import type { Label } from "@/lib/data/labels";

/**
 * The four controls that describe an issue.
 *
 * All of them submit as part of an ordinary <form action={serverAction}> — none of
 * them fetch, and none of them know an issue exists. That is what keeps the create
 * dialog and the detail page sharing one set of controls instead of two.
 */

export type MemberOption = { userId: string; displayName: string };

/** Radix Select forbids an item with an empty value, so "nobody" needs a name of its own. */
const UNASSIGNED = "unassigned";

function PickerLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <FieldLabel htmlFor={htmlFor} className="text-xs font-medium">
      {children}
    </FieldLabel>
  );
}

const triggerClass =
  "bg-card h-9 w-full justify-between rounded-lg px-2.5 text-sm font-normal";

export function StatusPicker({
  defaultValue = "backlog",
  name = "status",
}: {
  defaultValue?: IssueStatus;
  name?: string;
}) {
  return (
    <div className="space-y-1.5">
      <PickerLabel htmlFor={name}>Status</PickerLabel>

      {/*
        `name` is all that is needed to submit this: Radix mirrors the selection
        into a hidden native <select>, so the value arrives in FormData like any
        other field. No state, no controlled value, no effect.
      */}
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={name} className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          {ISSUE_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              <StatusIcon status={status} />
              {statusLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PriorityPicker({
  defaultValue = "none",
  name = "priority",
}: {
  defaultValue?: IssuePriority;
  name?: string;
}) {
  return (
    <div className="space-y-1.5">
      <PickerLabel htmlFor={name}>Priority</PickerLabel>

      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={name} className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          {ISSUE_PRIORITIES.map((priority) => (
            <SelectItem key={priority} value={priority}>
              <PriorityIcon priority={priority} />
              {priorityLabel(priority)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AssigneePicker({
  members,
  defaultValue,
}: {
  members: MemberOption[];
  /** The assignee's user id, or null for unassigned. */
  defaultValue?: string | null;
}) {
  // Controlled, unlike the two above, because the value the *form* submits is not
  // the value the *Select* holds: Radix cannot represent "unassigned" as an empty
  // string, so the trigger works in terms of a sentinel and the hidden input below
  // translates it back into what the server expects — "" meaning nobody.
  const [value, setValue] = useState(defaultValue ?? UNASSIGNED);

  return (
    <div className="space-y-1.5">
      <PickerLabel htmlFor="assignee">Assignee</PickerLabel>

      <input type="hidden" name="assigneeId" value={value === UNASSIGNED ? "" : value} />

      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id="assignee" className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          <SelectItem value={UNASSIGNED}>
            <span className="border-muted-foreground/40 size-5 rounded-full border border-dashed" />
            <span className="text-muted-foreground">Unassigned</span>
          </SelectItem>

          {members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              <Avatar name={member.displayName} className="size-5" />
              {member.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Labels: many, not one.
 *
 * Each checked label renders its own `<input name="labelIds">`, so the set arrives
 * as repeated fields and the action reads it with `getAll`. That is why this is the
 * only picker here that keeps a Set — the DOM has no multi-value input to lean on.
 */
export function LabelPicker({
  labels,
  defaultValue = [],
}: {
  labels: Label[];
  defaultValue?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue));

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      // A new Set every time: mutating the old one would keep the same reference
      // and React would not re-render.
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chosen = labels.filter((label) => selected.has(label.id));

  return (
    <div className="space-y-1.5">
      {/*
        A span, not a <label> — there is no single form control to point at, and a
        <label> with nothing to label is a lie to a screen reader. The classes match
        PickerLabel's so it sits on the same baseline as the three beside it.
      */}
      <span className="flex items-center text-xs leading-none font-medium">Labels</span>

      {chosen.map((label) => (
        <input key={label.id} type="hidden" name="labelIds" value={label.id} />
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(triggerClass, "gap-2 font-normal")}
            disabled={labels.length === 0}
          >
            {chosen.length === 0 ? (
              <span className="text-muted-foreground/70 flex items-center gap-2">
                <Tag className="size-3.5" aria-hidden="true" />
                {labels.length === 0 ? "No labels in this workspace" : "Add labels"}
              </span>
            ) : (
              // The dots alone, not the names: a row of four full chips would wrap
              // the trigger onto three lines. Names are one click away in the list.
              <span className="flex min-w-0 items-center gap-1.5">
                {chosen.map((label) => (
                  <LabelDot key={label.id} color={label.color} />
                ))}
                <span className="truncate">
                  {chosen.length === 1 ? chosen[0].name : `${chosen.length} labels`}
                </span>
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56 p-1">
          <ul>
            {labels.map((label) => {
              const checked = selected.has(label.id);
              return (
                <li key={label.id}>
                  <button
                    type="button"
                    onClick={() => toggle(label.id)}
                    aria-pressed={checked}
                    className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-100"
                  >
                    <LabelDot color={label.color} />
                    <span className="min-w-0 flex-1 truncate">{label.name}</span>
                    {checked ? (
                      <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
