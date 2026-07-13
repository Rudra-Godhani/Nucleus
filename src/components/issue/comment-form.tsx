"use client";

// 'use client': it reports errors and pending state from a server action, and the
// reply variant opens and closes.

import { useActionState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/avatar";
import { FormError, FormTextarea, SubmitButton } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { createCommentAction } from "@/app/(app)/w/[slug]/comments-actions";
import type { FormState } from "@/app/(app)/form-utils";

/**
 * Writing a comment.
 *
 * The same component whether it is a new thread or a reply — a reply is a comment
 * with a parent, and nothing else about it differs. Two components would be two
 * places to fix the next bug.
 */
export function CommentForm({
  workspaceId,
  issueId,
  slug,
  projectKey,
  number,
  authorName,
  parentId,
  onDone,
  autoFocus,
}: {
  workspaceId: string;
  issueId: string;
  slug: string;
  projectKey: string;
  number: number;
  /** The signed-in user, for the avatar beside the box. */
  authorName: string;
  /** Set when this is a reply. */
  parentId?: string;
  /** Called after a successful post — the reply box closes itself. */
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createCommentAction(prev, formData);
    if (result.success) {
      // Toast only for replies, which collapse on success and would otherwise give no
      // sign that anything happened. A top-level comment appears in the thread the
      // moment it posts, which is confirmation enough — announcing it as well is the
      // app telling you what you can already see.
      if (parentId) toast.success(result.success);
      onDone?.();
    }
    return result;
  }, {});

  return (
    <form action={formAction} className="flex gap-3" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="projectKey" value={projectKey} />
      <input type="hidden" name="number" value={number} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}

      <Avatar name={authorName} className="mt-0.5" />

      <div className="min-w-0 flex-1 space-y-2">
        <FormError message={state.formError} />

        <FormTextarea
          name="body"
          label={parentId ? "Reply" : "Comment"}
          // The label is the only thing announcing this box to a screen reader, and it
          // would be clutter on screen — the avatar and the button already say what
          // this is.
          labelHidden
          placeholder={parentId ? "Write a reply…" : "Leave a comment…"}
          className="min-h-16"
          autoFocus={autoFocus}
          errors={state.fieldErrors?.body}
        />

        <div className="flex justify-end gap-2">
          {onDone ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          ) : null}

          <SubmitButton size="sm" pendingLabel="Posting…">
            {parentId ? "Reply" : "Comment"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
