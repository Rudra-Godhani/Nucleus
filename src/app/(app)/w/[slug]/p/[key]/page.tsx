import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleDot, SearchX } from "lucide-react";
import { getMyRole, getWorkspaceBySlug, listMembers } from "@/lib/data/workspaces";
import { getProjectByKey } from "@/lib/data/projects";
import { listIssues } from "@/lib/data/issues";
import { listLabels } from "@/lib/data/labels";
import { issueFiltersSchema, type IssueFilters } from "@/lib/validations/issue";
import { PageHeader, PageShell, Section } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Identifier } from "@/components/shared/identifier";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";
import { CreateIssueDialog } from "@/components/issue/create-issue-dialog";
import { IssueFilters as IssueFilterBar } from "@/components/issue/issue-filters";
import { IssueList } from "@/components/issue/issue-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; key: string }>;
}): Promise<Metadata> {
  const { slug, key } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { title: "Project" };

  const project = await getProjectByKey(workspace.id, key);
  return { title: project?.name ?? "Project" };
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Turn the query string into filters.
 *
 * The URL is user input, so it is parsed, not trusted. A URL that does not parse
 * yields no filters at all rather than an error page: someone who hand-edits a query
 * string, or follows a link to a label that has since been deleted, should see the
 * project — not a crash.
 */
function parseFilters(searchParams: SearchParams): Partial<IssueFilters> {
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

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; key: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug, key }, query] = await Promise.all([params, searchParams]);

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

  const filters = parseFilters(query);
  const issues = await listIssues(project.id, filters);

  // "Nothing here" and "nothing matches" are different problems with different
  // fixes, so they get different empty states. Telling someone to file their first
  // issue when they have simply filtered them all out is worse than saying nothing.
  const filtered = Object.values(filters).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );

  const canManage = role === "owner" || role === "admin";

  const createDialog = (
    <CreateIssueDialog
      workspaceId={workspace.id}
      projectId={project.id}
      projectKey={project.key}
      slug={slug}
      members={members}
      labels={labels}
    />
  );

  return (
    // "list", not the default: an issue row is a table row, not a paragraph. See
    // PageShell for what the sizes mean and why this one exists.
    <PageShell size="list" className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <PageHeader
          title={project.name}
          description={project.description ?? undefined}
          actions={
            <>
              {canManage ? (
                <ProjectSettingsDialog
                  projectId={project.id}
                  projectKey={project.key}
                  name={project.name}
                  description={project.description}
                  workspaceId={workspace.id}
                  slug={slug}
                />
              ) : null}
              {createDialog}
            </>
          }
        />

        <Identifier className="text-muted-foreground mt-3 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px]">
          {project.key}
        </Identifier>
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Issues" className="space-y-5">
          {/*
            The filter bar sits above the list rather than beside the heading: four
            dropdowns next to a title is a squeeze on a laptop and an overflow on a
            phone, and filters read as a control strip for the thing below them.
          */}
          <IssueFilterBar members={members} labels={labels} />

          {issues.length === 0 && filtered ? (
            <EmptyState
              icon={SearchX}
              title="No issues match these filters"
              description="Clear a filter to widen the search."
            />
          ) : issues.length === 0 ? (
            <EmptyState
              icon={CircleDot}
              title="No issues yet"
              description={
                <>
                  The first one will be <Identifier>{project.key}-1</Identifier>.
                </>
              }
              action={createDialog}
            />
          ) : (
            <IssueList issues={issues} slug={slug} />
          )}
        </Section>
      </div>
    </PageShell>
  );
}
