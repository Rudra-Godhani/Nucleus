"use server";

import { revalidatePath } from "next/cache";
import { createComment, deleteComment, updateComment } from "@/lib/data/comments";
import {
  createCommentSchema,
  deleteCommentSchema,
  updateCommentSchema,
} from "@/lib/validations/comment";
import {
  formValues,
  optionalField,
  withFallbackError,
  type FormState,
} from "@/app/(app)/form-utils";

/**
 * Comment mutations.
 *
 * Every one of these revalidates the issue's own page and nothing else. A comment
 * does not change how the issue appears on a board or in a list, so refreshing those
 * would be work nobody asked for.
 */

/** The issue page these actions all write back to. */
function issuePath(formData: FormData): string | null {
  const slug = formData.get("slug");
  const projectKey = formData.get("projectKey");
  const number = formData.get("number");

  if (typeof slug !== "string" || typeof projectKey !== "string" || typeof number !== "string") {
    return null;
  }

  return `/w/${slug}/p/${projectKey}/${number}`;
}

export async function createCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createCommentSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    issueId: formData.get("issueId"),
    // A top-level comment has no parent field in the DOM at all, which is `null`, not
    // `""`. optionalField normalises both to undefined so "no parent" means no parent.
    parentId: optionalField(formData.get("parentId")),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  try {
    await createComment(parsed.data);
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Failed to post comment.",
      values: formValues(formData),
    };
  }

  const path = issuePath(formData);
  if (path) revalidatePath(path, "page");

  // No `values` echoed back. This is the one form in the app where a successful
  // submission SHOULD be wiped: React 19 resets an uncontrolled form once the action
  // completes, and here that is exactly right — the comment is now on the page, and
  // leaving a copy of it in the box invites posting it twice.
  return { success: "Comment posted." };
}

export async function updateCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateCommentSchema.safeParse({
    commentId: formData.get("commentId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  try {
    await updateComment(parsed.data);
  } catch (error) {
    // "You can only edit your own comments" arrives here, from RLS having changed
    // zero rows. It is a real answer, not a crash, so it is shown rather than thrown.
    return {
      formError: error instanceof Error ? error.message : "Failed to save comment.",
      values: formValues(formData),
    };
  }

  const path = issuePath(formData);
  if (path) revalidatePath(path, "page");

  return { success: "Comment saved." };
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const parsed = deleteCommentSchema.safeParse({ commentId: formData.get("commentId") });
  if (!parsed.success) return;

  await deleteComment(parsed.data.commentId);

  const path = issuePath(formData);
  if (path) revalidatePath(path, "page");
}
