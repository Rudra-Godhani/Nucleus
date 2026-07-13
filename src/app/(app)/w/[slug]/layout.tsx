import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";

/**
 * Shell for a single workspace.
 *
 * `getWorkspaceBySlug` returns null both when the slug does not exist and when
 * the caller is not a member — RLS makes them indistinguishable — so a non-member
 * gets a plain 404 rather than a "forbidden" that would confirm the workspace is
 * real. That is the intended behaviour, not an accident of error handling.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-border/60 flex h-11 shrink-0 items-center gap-1 border-b px-4">
        <span className="mr-3 text-sm font-medium">{workspace.name}</span>
        <WorkspaceTab href={`/w/${slug}`}>Overview</WorkspaceTab>
        <WorkspaceTab href={`/w/${slug}/members`}>Members</WorkspaceTab>
      </div>

      {children}
    </div>
  );
}

function WorkspaceTab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-2.5 py-1 text-sm transition-colors"
    >
      {children}
    </Link>
  );
}
