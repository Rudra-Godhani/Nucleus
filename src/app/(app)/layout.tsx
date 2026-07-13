import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { getCurrentUser } from "@/lib/data/auth";
import { getMyProfile } from "@/lib/data/profiles";
import { listMyWorkspaces } from "@/lib/data/workspaces";

/**
 * Shell for every signed-in route.
 *
 * The proxy already turns signed-out visitors away, but it is an optimistic check
 * and explicitly not a security boundary. This re-check is what actually stops
 * these pages rendering for an anonymous caller — and RLS protects the data
 * underneath regardless of both.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Independent reads: fetch together rather than in a waterfall.
  const [profile, workspaces] = await Promise.all([getMyProfile(), listMyWorkspaces()]);

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug }))}
        displayName={profile?.display_name ?? user.email}
        email={user.email}
      />

      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
