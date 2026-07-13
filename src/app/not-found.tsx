import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shared/logo";

/**
 * 404.
 *
 * This is also what a non-member sees when they guess a workspace URL — RLS makes
 * "does not exist" and "not yours" indistinguishable, and the copy is written to
 * cover both without hinting at which it was.
 */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-svh flex-col items-center justify-center gap-8 px-6 text-center"
    >
      <Link href="/" aria-label="Nucleus home" className="transition-opacity hover:opacity-70">
        <Wordmark className="text-base" />
      </Link>

      <div className="animate-rise space-y-3">
        <p className="font-display text-primary text-6xl tracking-tight tabular-nums">404</p>
        <h1 className="text-lg font-semibold tracking-tight">Nothing here</h1>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed text-balance">
          This page does not exist, or you do not have access to it.
        </p>
      </div>

      <Button asChild>
        <Link href="/workspaces">Back to Workspaces</Link>
      </Button>
    </main>
  );
}
