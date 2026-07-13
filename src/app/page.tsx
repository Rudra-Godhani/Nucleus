import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/data/auth";
import { getMyProfile } from "@/lib/data/profiles";
import { signOutAction } from "@/app/(auth)/actions";

/**
 * Landing route, and — until workspaces exist (Step 4) — the signed-in home.
 * Server Component: it reads the session on the server, so there is no flash of
 * signed-out UI.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-8 px-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Nucleus</h1>
          <p className="text-muted-foreground text-lg text-balance">
            An open-source issue tracker for teams. Projects, a keyboard-driven kanban board,
            and live updates — without the ceremony.
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Create an account</Link>
          </Button>
        </div>
      </main>
    );
  }

  const profile = await getMyProfile();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-8 px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Signed in as {profile?.display_name ?? user.email}
        </h1>
        <p className="text-muted-foreground">
          {user.email} · workspaces land in the next step.
        </p>
      </div>

      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
