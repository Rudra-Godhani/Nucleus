import type { Metadata } from "next";
import { CircleDot, SearchX } from "lucide-react";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getProjectByKey } from "@/lib/data/projects";
import { PageShell, Section } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Identifier } from "@/components/shared/identifier";
import { IssueFilters as IssueFilterBar } from "@/components/issue/issue-filters";
import { IssueList } from "@/components/issue/issue-list";
import { ProjectHeader } from "@/components/project/project-header";
import { CreateIssueDialog } from "@/components/issue/create-issue-dialog";
import { loadProjectView, type SearchParams } from "./project-view";

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

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; key: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug, key }, query] = await Promise.all([params, searchParams]);
  const view = await loadProjectView(slug, key, query);

  return (
    // "list", not the default: an issue row is a table row, not a paragraph. See
    // PageShell for what the sizes mean and why this one exists.
    <PageShell size="list" className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <ProjectHeader view={view} slug={slug} />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Issues" className="space-y-5">
          {/*
            The filter bar sits above the list rather than beside the heading: four
            dropdowns next to a title is a squeeze on a laptop and an overflow on a
            phone, and filters read as a control strip for the thing below them.
          */}
          <IssueFilterBar members={view.members} labels={view.labels} />

          {view.issues.length === 0 && view.filtered ? (
            <EmptyState
              icon={SearchX}
              title="No issues match these filters"
              description="Clear a filter to widen the search."
            />
          ) : view.issues.length === 0 ? (
            <EmptyState
              icon={CircleDot}
              title="No issues yet"
              description={
                <>
                  The first one will be <Identifier>{view.project.key}-1</Identifier>.
                </>
              }
              action={
                <CreateIssueDialog
                  workspaceId={view.workspace.id}
                  projectId={view.project.id}
                  projectKey={view.project.key}
                  slug={slug}
                  members={view.members}
                  labels={view.labels}
                />
              }
            />
          ) : (
            <IssueList issues={view.issues} slug={slug} />
          )}
        </Section>
      </div>
    </PageShell>
  );
}
