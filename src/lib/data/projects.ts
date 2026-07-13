import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import type { Database } from "@/lib/types/database.types";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validations/project";

export type Project = Database["public"]["Tables"]["projects"]["Row"];

/** A project plus the counts the list view needs, so the UI does not fan out per row. */
export type ProjectSummary = Project & {
  issueCount: number;
  openIssueCount: number;
};

/**
 * Every project in a workspace.
 *
 * There is no `.eq('workspace_id', ...)` guarding tenancy here — RLS already
 * restricts this to workspaces the caller belongs to. The filter is present
 * because this function is *asked* for one workspace, not because it is what makes
 * the query safe.
 *
 * The issue counts come back in the same round trip. Counting per project in the
 * component would be a classic N+1: ten projects, twenty-one queries.
 */
export async function listProjects(workspaceId: string): Promise<ProjectSummary[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*, issues(status)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load projects: ${error.message}`);

  return data.map(({ issues, ...project }) => ({
    ...project,
    issueCount: issues.length,
    // "Open" means still live work. `done` and `canceled` are both finished — one
    // happily, one not — and lumping them together is what a burndown actually
    // wants to know.
    openIssueCount: issues.filter(
      (issue) => issue.status !== "done" && issue.status !== "canceled",
    ).length,
  }));
}

/**
 * One project, by its key within a workspace (e.g. "PLAT" in "acme").
 *
 * Keyed by the human-facing identifier rather than a UUID so that project URLs are
 * readable and guessable — /w/acme/p/PLAT — which is also why the key is unique per
 * workspace.
 *
 * Returns null both when the key does not exist and when the caller is not a
 * member. RLS makes the two indistinguishable, and that is deliberate: a
 * non-member must not be able to probe for which projects exist.
 */
export async function getProjectByKey(
  workspaceId: string,
  key: string,
): Promise<Project | null> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("key", key.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(`Failed to load project: ${error.message}`);
  return data;
}

export type CreateProjectResult =
  | { ok: true; project: Project }
  | { ok: false; message: string };

/**
 * Create a project.
 *
 * Unlike `createWorkspace`, this one *can* use `.select()` — and that difference is
 * worth stating, because the two look like they should behave the same.
 *
 * A workspace is invisible to its own creator at the instant of INSERT: the row
 * that grants them membership is written by an AFTER INSERT trigger that has not
 * fired yet, so RETURNING trips the SELECT policy. A project has no such trigger —
 * the caller is already a member of the workspace, so the row is visible the moment
 * it exists. Guarded by supabase/tests/005.
 */
export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      key: input.key,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation. The only unique constraint a user can collide on
    // is (workspace_id, key), and saying so is far more useful than a generic
    // failure.
    if (error.code === "23505") {
      return {
        ok: false,
        message: `A project with the key ${input.key} already exists in this workspace.`,
      };
    }
    return { ok: false, message: `Failed to create project: ${error.message}` };
  }

  return { ok: true, project: data };
}

/**
 * Rename a project, or change its description.
 *
 * The key is deliberately NOT editable. Issue identifiers (PLAT-14) are written
 * into commit messages, pull requests and conversations; changing the prefix would
 * silently invalidate every reference to them that lives outside this database.
 */
export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .update({ name: input.name, description: input.description ?? null })
    .eq("id", input.projectId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return data;
}

/**
 * Delete a project, and every issue in it (the FK cascades).
 *
 * RLS restricts this to owners and admins. A plain member can create and work in
 * projects but cannot destroy one, because destroying one destroys other people's
 * work along with it.
 */
export async function deleteProject(projectId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}
