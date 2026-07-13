"use client";

// 'use client': a dialog with open state, and a toast on success.

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FormError,
  FormField,
  FormTextarea,
  SubmitButton,
} from "@/components/shared/form-field";
import {
  AssigneePicker,
  LabelPicker,
  PriorityPicker,
  StatusPicker,
  type MemberOption,
} from "@/components/issue/issue-pickers";
import { createIssueAction } from "@/app/(app)/w/[slug]/issues-actions";
import type { FormState } from "@/app/(app)/form-utils";
import type { Label } from "@/lib/data/labels";

/**
 * Filing an issue.
 *
 * Only the title is required. Everything else has a sensible default — backlog, no
 * priority, nobody — because the moment you have to classify a thought before you
 * can write it down is the moment you stop writing it down. Triage is a separate
 * job from capture, and this dialog is for capture.
 */
export function CreateIssueDialog({
  workspaceId,
  projectId,
  projectKey,
  slug,
  members,
  labels,
  trigger,
}: {
  workspaceId: string;
  projectId: string;
  projectKey: string;
  slug: string;
  members: MemberOption[];
  labels: Label[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Closing and toasting happen inside the action rather than in an effect
  // watching its result — see ProjectSettingsDialog for the full reasoning.
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createIssueAction(prev, formData);
    if (result.success) {
      toast.success(result.success);
      setOpen(false);
    }
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="size-3.5" aria-hidden="true" />
            New Issue
          </Button>
        )}
      </DialogTrigger>

      {/*
        Radix unmounts this when the dialog closes, which is what resets the
        pickers' state — so reopening after a successful create gives a genuinely
        blank form rather than the last issue's priority and labels.
      */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>
            It will be numbered automatically in {projectKey}.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="projectKey" value={projectKey} />
          <input type="hidden" name="slug" value={slug} />

          <FormError message={state.formError} />

          {/*
            `defaultValue` from the echoed submission: React 19 resets an
            uncontrolled form once the action completes, *including* when it
            failed, so without this a validation error would hand back a blank form.
          */}
          <FormField
            name="title"
            label="Title"
            placeholder="Something is broken"
            autoComplete="off"
            autoFocus
            defaultValue={state.values?.title ?? ""}
            errors={state.fieldErrors?.title}
          />

          <FormTextarea
            name="description"
            label="Description (optional)"
            placeholder="What happened, what you expected, how to reproduce it."
            defaultValue={state.values?.description ?? ""}
            errors={state.fieldErrors?.description}
          />

          <div className="grid grid-cols-2 gap-3">
            <StatusPicker />
            <PriorityPicker />
            <AssigneePicker members={members} />
            <LabelPicker labels={labels} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Creating…">Create Issue</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
