import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, UserPlus, Users } from "lucide-react";
import { getWorkspaceBySlug, listMembers } from "@/lib/data/workspaces";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Section } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/shared/avatar";

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

  const members = await listMembers(workspace.id);

  return (
    <PageShell className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <PageHeader
          title={workspace.name}
          description="Projects and issues land here next."
          actions={
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/w/${slug}/members`}>
                <UserPlus className="size-3.5" aria-hidden="true" />
                Invite
              </Link>
            </Button>
          }
        />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Projects">
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Projects group related issues. They arrive in the next step of the build."
          />
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
              here", and the list one click away answers "what can they do". */}
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
