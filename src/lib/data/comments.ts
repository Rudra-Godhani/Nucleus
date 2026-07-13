import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import type { CreateCommentInput, UpdateCommentInput } from "@/lib/validations/comment";

export type CommentAuthor = { id: string; displayName: string };

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  /** True when the signed-in user wrote it — the only person allowed to edit or delete it. */
  isMine: boolean;
  replies: Comment[];
};

type CommentRow = {
  id: string;
  body: string;
  parent_id: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles: { id: string; display_name: string } | null;
};

const COMMENT_SELECT = `
  id, body, parent_id, author_id, created_at, updated_at,
  profiles (id, display_name)
` as const;

/**
 * One issue's conversation, as a tree.
 *
 * The schema allows a reply to a reply; the UI renders exactly one level of nesting.
 * Rather than forbid deeper threads in the database, deeper ones are folded up onto
 * their top-level ancestor here — so a reply written by some future client, or by
 * hand in SQL, still appears in the conversation instead of vanishing from it.
 * Silently dropping a comment someone wrote is the worst thing this function could do.
 */
export async function listComments(issueId: string): Promise<Comment[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load comments: ${error.message}`);

  const rows = data as CommentRow[];

  const toComment = (row: CommentRow): Comment => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      // The join can be null in the type even though `author_id` is NOT NULL, because
      // RLS could in principle hide the profile. It cannot here — members of a shared
      // workspace can always see each other — but the fallback keeps the comment.
      displayName: row.profiles?.display_name ?? "Unknown",
    },
    isMine: row.author_id === user.id,
    replies: [],
  });

  const byId = new Map<string, Comment>(rows.map((row) => [row.id, toComment(row)]));
  const parentOf = new Map(rows.map((row) => [row.id, row.parent_id]));

  /** Walk up to the top-level comment this one hangs from. */
  function rootOf(id: string): string {
    const seen = new Set<string>();
    let current = id;

    while (true) {
      const parent = parentOf.get(current);
      // No parent, parent is gone, or — defensively — a cycle. A cycle cannot happen
      // through the app, but an unbounded `while` over data is how a page hangs
      // forever, and that is not a risk worth taking for one Set.
      if (!parent || !byId.has(parent) || seen.has(parent)) return current;
      seen.add(parent);
      current = parent;
    }
  }

  const roots: Comment[] = [];

  for (const row of rows) {
    const comment = byId.get(row.id)!;
    const root = rootOf(row.id);

    if (root === row.id) roots.push(comment);
    else byId.get(root)!.replies.push(comment);
  }

  return roots;
}

export async function createComment(input: CreateCommentInput): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("comments").insert({
    workspace_id: input.workspaceId,
    issue_id: input.issueId,
    parent_id: input.parentId,
    // Pinned by the RLS policy's WITH CHECK too — a member cannot post under a
    // colleague's name even by posting straight to the API. This line is convenience;
    // the policy is the guarantee.
    author_id: user.id,
    body: input.body,
  });

  if (error) {
    // 23503 = foreign_key_violation. With the tenant-scoped parent FK, this is what
    // replying to a comment in another workspace looks like.
    if (error.code === "23503") {
      throw new Error("That comment is not in this workspace.");
    }
    throw new Error(`Failed to post comment: ${error.message}`);
  }
}

/**
 * Edit a comment.
 *
 * No ownership check here, and none needed: the RLS policy allows an UPDATE only
 * where `author_id = auth.uid()`. Someone editing a colleague's comment gets zero
 * rows changed rather than an error — which is why the caller is told what happened
 * rather than left to assume it worked.
 */
export async function updateComment(input: UpdateCommentInput): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .update({ body: input.body })
    .eq("id", input.commentId)
    .select("id");

  if (error) throw new Error(`Failed to save comment: ${error.message}`);
  if (data.length === 0) throw new Error("You can only edit your own comments.");
}

export async function deleteComment(commentId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select("id");

  if (error) throw new Error(`Failed to delete comment: ${error.message}`);
  if (data.length === 0) throw new Error("You can only delete your own comments.");
}
