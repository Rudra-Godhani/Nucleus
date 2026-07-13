import { PageShell } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for signed-in routes.
 *
 * A skeleton that mirrors the real layout, not a centred spinner. A spinner tells
 * you to wait; a skeleton tells you what is coming and keeps the page from
 * jumping when the content lands.
 */
export default function AppLoading() {
  return (
    <PageShell>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="mt-10 space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="border-border divide-border bg-card divide-y rounded-xl border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
