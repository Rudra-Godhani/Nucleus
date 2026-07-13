import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleDot } from "lucide-react";
import { getMyRole, getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getProjectByKey } from "@/lib/data/projects";
import { PageHeader, PageShell, Section } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Identifier } from "@/components/shared/identifier";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";

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
}: {
  params: Promise<{ slug: string; key: string }>;
}) {
  const { slug, key } = await params;

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Independent of each other once the workspace is known.
  const [project, role] = await Promise.all([
    getProjectByKey(workspace.id, key),
    getMyRole(workspace.id),
  ]);

  // Null covers both "no such key" and "not yours" — RLS makes them
  // indistinguishable, which is what stops a non-member probing for project keys.
  if (!project) notFound();

  const canManage = role === "owner" || role === "admin";

  return (
    <PageShell className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <PageHeader
          title={project.name}
          description={project.description ?? undefined}
          actions={
            canManage ? (
              <ProjectSettingsDialog
                projectId={project.id}
                projectKey={project.key}
                name={project.name}
                description={project.description}
                workspaceId={workspace.id}
                slug={slug}
              />
            ) : null
          }
        />

        <Identifier className="text-muted-foreground mt-3 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px]">
          {project.key}
        </Identifier>
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Issues">
          <EmptyState
            icon={CircleDot}
            title="No issues yet"
            description={
              <>
                Issues here will be numbered <Identifier>{project.key}-1</Identifier>,{" "}
                <Identifier>{project.key}-2</Identifier>, and so on. They arrive in the next
                step.
              </>
            }
          />
        </Section>
      </div>
    </PageShell>
  );
}
