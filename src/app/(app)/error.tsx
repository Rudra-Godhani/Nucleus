"use client";

// An error boundary must be a Client Component — React needs to catch the throw
// on the client and re-render this in place of the subtree.

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nucleus has no error-reporting service (free tier, no paid dependencies),
    // so this is the only record that anything went wrong. Keep it.
    console.error(error);
  }, [error]);

  return (
    <PageShell size="narrow">
      <div className="animate-rise flex flex-col items-center py-16 text-center">
        <div className="bg-destructive/10 text-destructive mb-5 flex size-11 items-center justify-center rounded-xl">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </div>

        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>

        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-balance">
          This one is on us, not on you. Try again — and if it keeps happening, the reference
          below will tell us where to look.
        </p>

        {/* The digest is the only handle anyone has on a production error, since
            the real message is stripped from the client bundle. */}
        {error.digest ? (
          <code
            translate="no"
            className="text-muted-foreground bg-muted mt-4 rounded-md px-2 py-1 font-mono text-xs select-all"
          >
            {error.digest}
          </code>
        ) : null}

        <div className="mt-7 flex gap-2">
          <Button onClick={reset} className="gap-2">
            <RotateCw className="size-3.5" aria-hidden="true" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/workspaces">Back to Workspaces</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
