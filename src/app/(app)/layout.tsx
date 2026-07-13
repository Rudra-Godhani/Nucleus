import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/auth";
import { getMyProfile } from "@/lib/data/profiles";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/**
 * Shell for every signed-in route.
 *
 * The proxy already redirects signed-out visitors, but it is an optimistic check
 * and explicitly not a security boundary. Re-checking here is what actually keeps
 * these pages from rendering for an anonymous caller — and the data underneath is
 * protected by RLS regardless.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getMyProfile();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border/60 sticky top-0 z-10 flex h-12 shrink-0 items-center gap-4 border-b px-4 backdrop-blur">
        <Link href="/workspaces" className="text-sm font-semibold tracking-tight">
          Nucleus
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {profile?.display_name ?? user.email}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
