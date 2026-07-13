import type { Metadata } from "next";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getProjectByKey } from "@/lib/data/projects";
import { PageShell, Section } from "@/components/shared/page";
import { IssueFilters as IssueFilterBar } from "@/components/issue/issue-filters";
import { Board } from "@/components/issue/board";
import { ProjectHeader } from "@/components/project/project-header";
import { loadProjectView, type SearchParams } from "../project-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; key: string }>;
}): Promise<Metadata> {
  const { slug, key } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { title: "Board" };

  const project = await getProjectByKey(workspace.id, key);
  return { title: project ? `${project.name} · Board` : "Board" };
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; key: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug, key }, query] = await Promise.all([params, searchParams]);
  const view = await loadProjectView(slug, key, query);

  return (
    // "wide": five columns need the room, and this is the screen PageShell's widest
    // measure exists for.
    <PageShell size="wide" className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <ProjectHeader view={view} slug={slug} />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Board" className="space-y-5">
          <IssueFilterBar members={view.members} labels={view.labels} />

          {/*
            No empty state here, unlike the list. An empty board is not an absence of
            anything — it is five labelled columns waiting to be dropped into, and
            replacing them with a "no issues yet" card would take away the only place
            a card can go.
          */}
          <Board
            issues={view.issues}
            slug={slug}
            projectKey={view.project.key}
            projectId={view.project.id}
          />
        </Section>
      </div>
    </PageShell>
  );
}
