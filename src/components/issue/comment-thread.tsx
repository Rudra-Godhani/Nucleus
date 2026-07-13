"use client";

// 'use client': each comment can open a reply box or switch into an edit box, and
// that is local state per comment.

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Pencil, Reply, Trash2 } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { FormError, FormTextarea, SubmitButton } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { CommentForm } from "@/components/issue/comment-form";
import {
  deleteCommentAction,
  updateCommentAction,
} from "@/app/(app)/w/[slug]/comments-actions";
import type { FormState } from "@/app/(app)/form-utils";
import type { Comment } from "@/lib/data/comments";

type Context = {
  workspaceId: string;
  issueId: string;
  slug: string;
  projectKey: string;
  number: number;
  currentUserName: string;
};

/**
 * One comment, its replies, and the controls for both.
 *
 * Replies are one level deep and no deeper. A tree that can nest forever produces
 * conversations nobody can follow and a left margin that eventually runs out of
 * page; a single level says "this is about that" and stops. The data layer folds any
 * deeper thread up onto its top-level ancestor, so nothing is ever hidden — see
 * `listComments`.
 */
export function CommentItem({
  comment,
  context,
  isReply,
}: {
  comment: Comment;
  context: Context;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <li className="space-y-3">
      <article className="flex gap-3">
        <Avatar name={comment.author.displayName} className="mt-0.5" />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.author.displayName}</span>
            <RelativeTime iso={comment.createdAt} className="text-muted-foreground text-xs" />

            {/* Only when it has actually been edited — an "(edited)" on every comment
                would be noise, and its absence is what makes it meaningful. */}
            {comment.updatedAt !== comment.createdAt ? (
              <span className="text-muted-foreground text-xs">· edited</span>
            ) : null}
          </div>

          {editing ? (
            <EditCommentForm
              comment={comment}
              context={context}
              onDone={() => setEditing(false)}
            />
          ) : (
            <>
              {/*
                `whitespace-pre-wrap`: comments are plain text, and the paragraph
                breaks somebody typed are part of what they wrote. Collapsing them
                would turn a considered comment into a wall.
              */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>

              <div className="flex items-center gap-1">
                {/* A reply to a reply would nest forever, so replies answer the thread
                    rather than each other. */}
                {!isReply ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setReplying((open) => !open)}
                  >
                    <Reply className="size-3" aria-hidden="true" />
                    Reply
                  </Button>
                ) : null}

                {/* Shown only to the author — and enforced by RLS, which allows an
                    UPDATE or DELETE only where author_id = auth.uid(). Hiding the
                    button is a courtesy; the policy is the rule. */}
                {comment.isMine ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                      Edit
                    </Button>

                    <ConfirmButton
                      action={deleteCommentAction}
                      hidden={{
                        commentId: comment.id,
                        slug: context.slug,
                        projectKey: context.projectKey,
                        number: String(context.number),
                      }}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive h-7 gap-1.5 px-2 text-xs"
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                          Delete
                        </Button>
                      }
                      title="Delete this comment?"
                      description={
                        comment.replies.length > 0
                          ? "Its replies are deleted with it. This cannot be undone."
                          : "This cannot be undone."
                      }
                      confirmLabel="Delete Comment"
                      pendingLabel="Deleting…"
                    />
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </article>

      {(comment.replies.length > 0 || replying) && (
        // The rule down the left is what makes a reply legible as a reply at a glance,
        // without having to compare indentation between two blocks of text.
        <ul className="border-border ml-3.5 space-y-4 border-l pl-5">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} context={context} isReply />
          ))}

          {replying ? (
            <li>
              <CommentForm
                workspaceId={context.workspaceId}
                issueId={context.issueId}
                slug={context.slug}
                projectKey={context.projectKey}
                number={context.number}
                authorName={context.currentUserName}
                parentId={comment.id}
                onDone={() => setReplying(false)}
                autoFocus
              />
            </li>
          ) : null}
        </ul>
      )}
    </li>
  );
}

function EditCommentForm({
  comment,
  context,
  onDone,
}: {
  comment: Comment;
  context: Context;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await updateCommentAction(prev, formData);
    if (result.success) {
      toast.success(result.success);
      onDone();
    }
    return result;
  }, {});

  return (
    <form action={formAction} className="space-y-2" noValidate>
      <input type="hidden" name="commentId" value={comment.id} />
      <input type="hidden" name="slug" value={context.slug} />
      <input type="hidden" name="projectKey" value={context.projectKey} />
      <input type="hidden" name="number" value={String(context.number)} />

      <FormError message={state.formError} />

      <FormTextarea
        name="body"
        label="Edit comment"
        labelHidden
        defaultValue={state.values?.body ?? comment.body}
        className="min-h-16"
        autoFocus
        errors={state.fieldErrors?.body}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
