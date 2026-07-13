import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/data/auth";

/**
 * Landing route. A signed-in visitor goes straight to their workspaces; the
 * picker itself skips ahead again if they only have one.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/workspaces");

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-8 px-6">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Nucleus</h1>
        <p className="text-muted-foreground text-lg text-balance">
          An open-source issue tracker for teams. Projects, a keyboard-driven kanban board, and
          live updates — without the ceremony.
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
