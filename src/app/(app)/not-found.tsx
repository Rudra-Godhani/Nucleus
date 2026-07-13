import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page";

/**
 * 404 inside the signed-in app.
 *
 * Distinct from the root `not-found.tsx` because the app header is already on
 * screen here — repeating the wordmark underneath it just looks like a mistake.
 *
 * This is also what a member sees when they guess a workspace URL that is not
 * theirs. RLS makes "does not exist" and "not yours" indistinguishable, and the
 * copy is written to cover both without hinting at which one it was.
 */
export default function AppNotFound() {
  return (
    <PageShell size="narrow">
      <div className="animate-rise flex flex-col items-center py-20 text-center">
        <p className="font-display text-primary text-6xl tracking-tight tabular-nums">404</p>

        <h1 className="mt-3 text-lg font-semibold tracking-tight">Nothing here</h1>

        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-balance">
          This page does not exist, or you do not have access to it.
        </p>

        <Button asChild className="mt-7">
          <Link href="/workspaces">Back to Workspaces</Link>
        </Button>
      </div>
    </PageShell>
  );
}
