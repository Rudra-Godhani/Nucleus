"use client";

// 'use client': the edit form reports errors and a pending state from a server
// action, and the pickers hold their own selection.

import { useActionState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FormError,
  FormField,
  FormTextarea,
  SubmitButton,
} from "@/components/shared/form-field";
import { ConfirmButton } from "@/components/shared/confirm-button";
import {
  AssigneePicker,
  LabelPicker,
  PriorityPicker,
  StatusPicker,
  type MemberOption,
} from "@/components/issue/issue-pickers";
import {
  deleteIssueAction,
  updateIssueAction,
} from "@/app/(app)/w/[slug]/issues-actions";
import type { FormState } from "@/app/(app)/form-utils";
import type { Issue } from "@/lib/data/issues";
import type { Label } from "@/lib/data/labels";

/**
 * The issue, editable in place.
 *
 * There is no read mode and no edit mode. An issue tracker's detail page exists to
 * be changed — the common visit is "move this to In Progress" or "give this to
 * Sam" — and a view/edit toggle taxes every one of those with a click that does
 * nothing but grant permission. So the fields *are* the view.
 *
 * One form covers the whole thing, including the properties. Changing a status and
 * fixing a typo is one save, not two, and there is no half-saved state to reason
 * about.
 */
export function IssueDetail({
  issue,
  slug,
  members,
  labels,
}: {
  issue: Issue;
  slug: string;
  members: MemberOption[];
  labels: Label[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await updateIssueAction(prev, formData);
    if (result.success) toast.success(result.success);
    return result;
  }, {});

  return (
    <div className="space-y-6">
      {/*
        `key` on the form, not on a field.

        Everything below is uncontrolled — it renders `issue` as its defaultValue and
        the browser owns it from then on. That is what makes typing feel instant, but
        it also means a *new* issue prop would be ignored, because React does not
        touch a defaultValue on re-render. Keying the form on the issue's id and its
        last-updated time tells React to build a fresh form whenever the underlying
        issue actually changed — which is exactly when the fields should be replaced.
      */}
      <form
        key={`${issue.id}:${issue.updated_at}`}
        action={formAction}
        className="grid gap-6 lg:grid-cols-[1fr_15rem]"
        noValidate
      >
        <input type="hidden" name="issueId" value={issue.id} />
        <input type="hidden" name="slug" value={slug} />

        <div className="min-w-0 space-y-4">
          <FormError message={state.formError} />

          <FormField
            name="title"
            label="Title"
            defaultValue={state.values?.title ?? issue.title}
            autoComplete="off"
            className="h-11 text-base font-medium"
            errors={state.fieldErrors?.title}
          />

          <FormTextarea
            name="description"
            label="Description"
            placeholder="Add more detail…"
            defaultValue={state.values?.description ?? issue.description ?? ""}
            className="min-h-40"
            errors={state.fieldErrors?.description}
          />

          <div className="flex justify-end">
            <SubmitButton pendingLabel="Saving…">Save Changes</SubmitButton>
          </div>
        </div>

        {/*
          The properties sit in a rail on desktop and stack underneath on mobile.
          They are the same four controls the create dialog uses — one definition,
          so an issue cannot be describable one way at birth and another way later.
        */}
        <aside className="space-y-3 lg:border-l lg:pl-6">
          <StatusPicker defaultValue={issue.status} />
          <PriorityPicker defaultValue={issue.priority} />
          <AssigneePicker members={members} defaultValue={issue.assignee?.id ?? null} />
          <LabelPicker labels={labels} defaultValue={issue.labels.map((label) => label.id)} />
        </aside>
      </form>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          Deleting an issue is permanent. Its number is not reused.
        </p>

        {/* Outside the form above: a form cannot be nested inside another form. */}
        <ConfirmButton
          action={deleteIssueAction}
          hidden={{
            issueId: issue.id,
            slug,
            projectKey: issue.projectKey,
          }}
          trigger={
            <Button variant="outline" size="sm" className="text-destructive gap-2">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
          }
          title={`Delete ${issue.identifier}?`}
          description="This removes the issue, its labels and its comments. It cannot be undone."
          confirmLabel="Delete Issue"
          pendingLabel="Deleting…"
        />
      </div>
    </div>
  );
}
