import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";

/**
 * Workspace scope guard.
 *
 * There is no chrome here any more — navigation moved into the app header, so
 * this layout's only job is to establish that the workspace exists and the caller
 * is a member of it.
 *
 * `getWorkspaceBySlug` returns null both when the slug does not exist and when the
 * caller is not a member; RLS makes the two indistinguishable. A non-member
 * therefore gets a plain 404 rather than a "forbidden" that would confirm the
 * workspace is real. That is the intended behaviour, not an accident of error
 * handling.
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

  return <>{children}</>;
}
