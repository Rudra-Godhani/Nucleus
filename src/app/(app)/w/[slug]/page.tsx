import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug, listMembers } from "@/lib/data/workspaces";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  return { title: workspace?.name ?? "Workspace" };
}

/**
 * Workspace overview. Projects land here in the next step; for now this confirms
 * the workspace resolves and shows who is in it.
 */
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
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {members.length} {members.length === 1 ? "member" : "members"}
      </p>

      <div className="border-border/60 mt-10 rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground text-sm">
          Projects arrive in the next step. Until then, invite your team.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link href={`/w/${slug}/members`}>Manage members</Link>
        </Button>
      </div>
    </div>
  );
}
