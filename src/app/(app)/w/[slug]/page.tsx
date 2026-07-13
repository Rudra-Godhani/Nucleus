import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, UserPlus, Users } from "lucide-react";
import { getWorkspaceBySlug, listMembers } from "@/lib/data/workspaces";
import { listProjects } from "@/lib/data/projects";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Section } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/shared/avatar";
import { ProjectList } from "@/components/project/project-list";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  return { title: workspace?.name ?? "Workspace" };
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Independent reads: fetch together rather than in a waterfall.
  const [projects, members] = await Promise.all([
    listProjects(workspace.id),
    listMembers(workspace.id),
  ]);

  return (
    <PageShell className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <PageHeader
          title={workspace.name}
          description={
            projects.length === 0
              ? "Start by creating a project."
              : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
          }
          actions={
            <>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/w/${slug}/members`}>
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Invite
                </Link>
              </Button>
              {projects.length > 0 ? (
                <CreateProjectDialog workspaceId={workspace.id} slug={slug} />
              ) : null}
            </>
          }
        />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Projects">
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Projects group related issues, and give them an identifier like PLAT-14."
              action={<CreateProjectDialog workspaceId={workspace.id} slug={slug} />}
            />
          ) : (
            <ProjectList projects={projects} slug={slug} />
          )}
        </Section>
      </div>

      <div style={{ "--i": 2 } as React.CSSProperties} className="mt-10">
        <Section
          title="Team"
          description={`${members.length} ${members.length === 1 ? "person has" : "people have"} access`}
          actions={
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href={`/w/${slug}/members`}>
                <Users className="size-3.5" aria-hidden="true" />
                Manage
              </Link>
            </Button>
          }
        >
          {/* A face pile rather than a list — at a glance this answers "who is
              here"; the members page answers "what can they do". */}
          <div className="flex flex-wrap items-center gap-2">
            {members.map((member) => (
              <div
                key={member.userId}
                className="border-border bg-card flex items-center gap-2 rounded-full border py-1 pr-3 pl-1"
              >
                <Avatar name={member.displayName} className="size-6" />
                <span className="text-sm">{member.displayName}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PageShell>
  );
}
