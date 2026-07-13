import { notFound } from "next/navigation";
import { getMyRole, getWorkspaceBySlug, listMembers } from "@/lib/data/workspaces";
import { getProjectByKey } from "@/lib/data/projects";
import { listIssues } from "@/lib/data/issues";
import { listLabels } from "@/lib/data/labels";
import { issueFiltersSchema, type IssueFilters } from "@/lib/validations/issue";

/**
 * Everything the list and the board both need.
 *
 * They are the same data seen two ways, so they load it the same way. Kept here
 * rather than duplicated across the two routes, because the moment a filter means
 * one thing on the list and another on the board, the view switcher starts lying.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Turn the query string into filters.
 *
 * The URL is user input, so it is parsed, not trusted — an `assignee` of "🙂" would
 * otherwise go straight into a `.eq()` and come back as a Postgres cast error. A URL
 * that does not parse yields NO filters rather than an error page: someone who
 * hand-edits a query string, or follows a link to a label that has since been
 * deleted, should see the project rather than a crash.
 */
export function parseFilters(searchParams: SearchParams): Partial<IssueFilters> {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const status = first(searchParams.status);
  const priority = first(searchParams.priority);

  const parsed = issueFiltersSchema.safeParse({
    // The UI filters by one status at a time; the schema takes a list because the
    // data layer and the saved views of Step 10 both want more than one.
    status: status ? [status] : [],
    priority: priority ? [priority] : [],
    assigneeId: first(searchParams.assignee),
    labelId: first(searchParams.label),
  });

  return parsed.success ? parsed.data : {};
}

export async function loadProjectView(
  slug: string,
  key: string,
  searchParams: SearchParams,
) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const [project, role, members, labels] = await Promise.all([
    getProjectByKey(workspace.id, key),
    getMyRole(workspace.id),
    listMembers(workspace.id),
    listLabels(workspace.id),
  ]);

  // Null covers both "no such key" and "not yours" — RLS makes them
  // indistinguishable, which is what stops a non-member probing for project keys.
  if (!project) notFound();

  const filters = parseFilters(searchParams);
  const issues = await listIssues(project.id, filters);

  // "Nothing here" and "nothing matches" are different problems with different fixes,
  // so the views give them different empty states. Telling someone to file their
  // first issue when they have simply filtered them all out is worse than silence.
  const filtered = Object.values(filters).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );

  return {
    workspace,
    project,
    members,
    labels,
    issues,
    filtered,
    canManage: role === "owner" || role === "admin",
  };
}
