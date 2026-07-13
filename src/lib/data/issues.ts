import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import type { Database } from "@/lib/types/database.types";
import type {
  CreateIssueInput,
  IssueFilters,
  MoveIssueInput,
  UpdateIssueInput,
} from "@/lib/validations/issue";

type IssueRow = Database["public"]["Tables"]["issues"]["Row"];
export type IssueStatus = Database["public"]["Enums"]["issue_status"];
export type IssuePriority = Database["public"]["Enums"]["issue_priority"];

export type Label = { id: string; name: string; color: string };

export type IssueAssignee = { id: string; displayName: string } | null;

/** An issue as the UI needs it: joins resolved, identifier pre-built. */
export type Issue = IssueRow & {
  /** "PLAT-14". Built here so no component has to know how to spell it. */
  identifier: string;
  projectKey: string;
  assignee: IssueAssignee;
  labels: Label[];
};

/**
 * The shape PostgREST returns for the join below. Written out rather than
 * inferred, because the generated types cannot express an embedded select.
 */
type IssueJoinRow = IssueRow & {
  projects: { key: string } | null;
  member: { user_id: string; profiles: { display_name: string } | null } | null;
  issue_labels: { labels: Label | null }[];
};

/**
 * One SELECT, with the project, assignee and labels embedded.
 *
 * The alternative — fetch issues, then a query per issue for its labels and
 * assignee — is the classic N+1: a board with 50 cards would fire 101 requests.
 * PostgREST resolves the whole graph in a single round trip.
 *
 * The assignee is reached through `workspace_members`, not straight from
 * `profiles`, and that is not a detour — it is the schema saying what an assignee
 * *is*. `issues.assignee_id` has no foreign key to `profiles` at all: it points at
 * `workspace_members (user_id, workspace_id)`, so an assignee is by construction a
 * member of this workspace and not merely some user who exists. See the
 * tenant-scoped-foreign-keys migration.
 */
const ISSUE_SELECT = `
  *,
  projects!issues_project_fkey (key),
  member:workspace_members!issues_assignee_fkey (
    user_id,
    profiles (display_name)
  ),
  issue_labels (labels (id, name, color))
` as const;

function toIssue(row: IssueJoinRow): Issue {
  const projectKey = row.projects?.key ?? "";

  return {
    ...row,
    projectKey,
    identifier: `${projectKey}-${row.number}`,
    assignee: row.member?.profiles
      ? { id: row.member.user_id, displayName: row.member.profiles.display_name }
      : null,
    // A label can be null here if the join row survives but the label does not;
    // the composite FK makes that impossible, but the type still admits it.
    labels: row.issue_labels.map((join) => join.labels).filter((l): l is Label => l !== null),
  };
}

/**
 * Issues in a project, filtered.
 *
 * No tenancy check here and none needed: RLS restricts every row to workspaces the
 * caller belongs to. The `project_id` filter is what was *asked for*, not what
 * makes this safe.
 */
export async function listIssues(
  projectId: string,
  filters?: Partial<IssueFilters>,
): Promise<Issue[]> {
  await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("issues")
    .select(ISSUE_SELECT)
    .eq("project_id", projectId)
    // The board reads columns in this order, and so does the list.
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters?.status?.length) query = query.in("status", filters.status);
  if (filters?.priority?.length) query = query.in("priority", filters.priority);

  if (filters?.assigneeId === "unassigned") {
    query = query.is("assignee_id", null);
  } else if (filters?.assigneeId) {
    query = query.eq("assignee_id", filters.assigneeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load issues: ${error.message}`);

  const issues = (data as IssueJoinRow[]).map(toIssue);

  // Label filtering happens here rather than in SQL on purpose. Filtering an
  // embedded join in PostgREST turns it into an INNER JOIN, which would also strip
  // every *other* label off the returned issues — so a card filtered by "bug" would
  // render as though "bug" were its only label. The row count here is one project's
  // issues, so the cost is negligible.
  if (filters?.labelId) {
    return issues.filter((issue) => issue.labels.some((l) => l.id === filters.labelId));
  }

  return issues;
}

/** One issue by its project-scoped number, e.g. PLAT-14. */
export async function getIssueByNumber(
  projectId: string,
  issueNumber: number,
): Promise<Issue | null> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_SELECT)
    .eq("project_id", projectId)
    .eq("number", issueNumber)
    .maybeSingle();

  if (error) throw new Error(`Failed to load issue: ${error.message}`);
  // Null covers both "no such issue" and "not yours" — RLS makes them
  // indistinguishable, which is what stops a non-member probing for issues.
  return data ? toIssue(data as IssueJoinRow) : null;
}

export type CreateIssueResult = { ok: true; issue: Issue } | { ok: false; message: string };

/**
 * Create an issue.
 *
 * `number` is not supplied: the `assign_issue_number` trigger takes it from the
 * project's counter under a row lock, so two people filing at once cannot be handed
 * the same number.
 */
export async function createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("issues")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId,
      // Pinned by the RLS policy's WITH CHECK too — a member cannot file an issue
      // under a colleague's name even by posting directly to the API.
      created_by: user.id,
    })
    .select("id, number, project_id")
    .single();

  if (error) {
    // 23503 = foreign_key_violation. With tenant-scoped composite FKs, this is what
    // a cross-workspace reference looks like: a project, assignee or label that is
    // not in this workspace.
    if (error.code === "23503") {
      return {
        ok: false,
        message: "That project, assignee or label does not belong to this workspace.",
      };
    }
    return { ok: false, message: `Failed to create issue: ${error.message}` };
  }

  if (input.labelIds.length > 0) {
    const { error: labelError } = await supabase.from("issue_labels").insert(
      input.labelIds.map((labelId) => ({
        issue_id: data.id,
        label_id: labelId,
        workspace_id: input.workspaceId,
      })),
    );
    if (labelError) {
      return { ok: false, message: `Issue created, but labels failed: ${labelError.message}` };
    }
  }

  const issue = await getIssueByNumber(data.project_id, data.number);
  if (!issue) return { ok: false, message: "Issue was created but could not be loaded." };

  return { ok: true, issue };
}

export async function updateIssue(input: UpdateIssueInput): Promise<Issue> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("issues")
    .update({
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId,
    })
    .eq("id", input.issueId)
    .select("id, number, project_id, workspace_id")
    .single();

  if (error) throw new Error(`Failed to update issue: ${error.message}`);

  await setIssueLabels(data.id, data.workspace_id, input.labelIds);

  const issue = await getIssueByNumber(data.project_id, data.number);
  if (!issue) throw new Error("Issue was updated but could not be reloaded.");
  return issue;
}

/**
 * Replace an issue's labels.
 *
 * Delete-then-insert rather than a diff. The set is tiny, the two statements are
 * cheap, and "make it look like this list" is far easier to reason about than
 * working out what changed — which is where label bugs come from.
 */
async function setIssueLabels(
  issueId: string,
  workspaceId: string,
  labelIds: string[],
): Promise<void> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("issue_labels")
    .delete()
    .eq("issue_id", issueId);
  if (deleteError) throw new Error(`Failed to clear labels: ${deleteError.message}`);

  if (labelIds.length === 0) return;

  const { error: insertError } = await supabase.from("issue_labels").insert(
    labelIds.map((labelId) => ({
      issue_id: issueId,
      label_id: labelId,
      workspace_id: workspaceId,
    })),
  );
  if (insertError) throw new Error(`Failed to set labels: ${insertError.message}`);
}

/**
 * Move an issue: which column, and where in it. This is what a drop on the board is.
 *
 * `position` is a fraction, not an index. Dropping a card between two others writes
 * ONE row — the midpoint of its new neighbours — where an index would mean
 * renumbering every card below it, which is a write per card and a race with anyone
 * else dragging in the same column.
 *
 * The cost is that repeatedly splitting the same gap eventually exhausts the
 * precision of a double (about fifty halvings). At that point positions would need
 * rebalancing; a board that has been dragged fifty times into one identical slot is
 * not a problem this app has, and pretending to solve it would cost more than it saves.
 */
export async function moveIssue(input: MoveIssueInput): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("issues")
    .update({ status: input.status, position: input.position })
    .eq("id", input.issueId);

  if (error) throw new Error(`Failed to move issue: ${error.message}`);
}

/**
 * Full-text search across a workspace's issues.
 *
 * The work happens in Postgres — a GIN index over a generated tsvector, ranked so that
 * a word in the title beats the same word in a description. See the issue_search
 * migration for why it is an RPC and not a PostgREST filter (ordering by rank), and
 * why the function must stay SECURITY INVOKER (RLS).
 *
 * `.select(ISSUE_SELECT)` on top of the RPC: PostgREST will embed relations into the
 * result of a function that returns `setof issues`, so a search result is the same
 * fully-populated Issue as a list row — same identifier, same labels, same assignee —
 * rather than a thinner thing the UI has to special-case.
 */
export async function searchIssues(workspaceId: string, query: string): Promise<Issue[]> {
  await requireUser();
  const supabase = await createClient();

  // An empty query is not a search, it is a page that has not been used yet. Asking
  // the database to match nothing is a round trip for a guaranteed empty list.
  if (query.trim() === "") return [];

  const { data, error } = await supabase
    .rpc("search_issues", { workspace: workspaceId, q: query })
    .select(ISSUE_SELECT);

  if (error) throw new Error(`Search failed: ${error.message}`);

  // The RPC's ORDER BY survives the embed, so the rank order is preserved here.
  return (data as unknown as IssueJoinRow[]).map(toIssue);
}

export async function deleteIssue(issueId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("issues").delete().eq("id", issueId);
  if (error) throw new Error(`Failed to delete issue: ${error.message}`);
}
