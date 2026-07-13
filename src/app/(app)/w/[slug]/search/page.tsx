import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { searchIssues } from "@/lib/data/issues";
import { PageHeader, PageShell } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/issue/search-input";
import { IssueList } from "@/components/issue/issue-list";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const raw = Array.isArray(query.q) ? query.q[0] : query.q;
  const q = (raw ?? "").trim();

  // No sanitising of `q` beyond the trim, and none needed: it goes to
  // `websearch_to_tsquery`, which parses arbitrary text and cannot be made to raise —
  // unlike `to_tsquery`, where a lone `&` is a syntax error and therefore a 500. The
  // parameter is bound, not interpolated, so there is nothing to inject into either.
  const issues = q ? await searchIssues(workspace.id, q) : [];

  return (
    <PageShell size="list" className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties} className="space-y-6">
        <PageHeader
          title="Search"
          description="Across every project in this workspace. Titles are weighted above descriptions."
        />

        <SearchInput basePath={`/w/${slug}/search`} />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-8">
        {!q ? (
          <EmptyState
            icon={Search}
            title="Search this workspace"
            description="Find an issue by anything in its title or description. Quote a “phrase” to match it exactly, or put a minus in front of a -word to exclude it."
          />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`Nothing matches “${q}”`}
            description="Try fewer words, or a different one."
          />
        ) : (
          <>
            <p className="text-muted-foreground mb-4 text-xs">
              {issues.length === 1 ? "1 issue" : `${issues.length} issues`}
              {/* The RPC caps at 50. Saying so is the honest thing: a result list that
                  silently stops is a result list that has lied about what is there. */}
              {issues.length === 50 ? " (showing the first 50)" : ""}
            </p>

            {/* Ungrouped: these arrive in rank order, best match first, and grouping
                them by status would sort that away. */}
            <IssueList issues={issues} slug={slug} grouped={false} />
          </>
        )}
      </div>
    </PageShell>
  );
}
