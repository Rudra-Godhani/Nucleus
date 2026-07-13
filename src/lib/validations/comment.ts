import { z } from "zod";

/**
 * Comment input boundaries. These mirror the CHECK constraint on `comments.body`
 * exactly — if Zod were laxer, a user would get an opaque 500 from Postgres instead
 * of a field error telling them what is wrong.
 */

const body = z
  .string()
  .trim()
  .min(1, "Say something")
  .max(10_000, "A comment must be at most 10,000 characters");

export const createCommentSchema = z.object({
  workspaceId: z.uuid(),
  issueId: z.uuid(),
  /**
   * The comment being replied to, or null for a new thread.
   *
   * An empty string means "not a reply", not "invalid": a hidden field that is
   * present but blank submits "", and a plain `z.uuid().optional()` would reject it.
   */
  parentId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((value) => (value ? value : null)),
  body,
});

export const updateCommentSchema = z.object({
  commentId: z.uuid(),
  body,
});

export const deleteCommentSchema = z.object({
  commentId: z.uuid(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
