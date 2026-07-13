import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getWorkspaceBySlug, listMembers } from "@/lib/data/workspaces";
import { getProjectByKey } from "@/lib/data/projects";
import { getIssueByNumber } from "@/lib/data/issues";
import { listLabels } from "@/lib/data/labels";
import { PageShell } from "@/components/shared/page";
import { Identifier } from "@/components/shared/identifier";
import { RelativeTime } from "@/components/shared/relative-time";
import { IssueDetail } from "@/components/issue/issue-detail";

type RouteParams = { slug: string; key: string; number: string };

/**
 * Read an issue for a route.
 *
 * Shared by the page and its metadata, which both need the same three lookups. Next
 * dedupes the fetches within a single request, so calling this twice does not query
 * twice.
 */
async function loadIssue(params: RouteParams) {
  const workspace = await getWorkspaceBySlug(params.slug);
  if (!workspace) return null;

  const project = await getProjectByKey(workspace.id, params.key);
  if (!project) return null;

  // The URL segment is a string. A non-numeric one is a 404, not a 500 — someone
  // typing /p/PLAT/banana should be told there is nothing there.
  const number = Number(params.number);
  if (!Number.isInteger(number) || number < 1) return null;

  const issue = await getIssueByNumber(project.id, number);
  if (!issue) return null;

  return { workspace, project, issue };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const loaded = await loadIssue(await params);
  if (!loaded) return { title: "Issue" };

  return { title: `${loaded.issue.identifier} · ${loaded.issue.title}` };
}

export default async function IssuePage({ params }: { params: Promise<RouteParams> }) {
  const { slug, key, number } = await params;

  const loaded = await loadIssue({ slug, key, number });
  // Null covers "no such issue" and "not yours" alike — RLS makes them
  // indistinguishable, which is what stops a non-member probing for issue numbers.
  if (!loaded) notFound();

  const { workspace, issue } = loaded;

  const [members, labels] = await Promise.all([
    listMembers(workspace.id),
    listLabels(workspace.id),
  ]);

  return (
    // The same measure as the list it came from, so following a row into an issue
    // does not visibly resize the page under you.
    <PageShell size="list" className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties} className="space-y-4">
        <Link
          href={`/w/${slug}/p/${key}`}
          className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          {loaded.project.name}
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Identifier className="text-muted-foreground text-sm">{issue.identifier}</Identifier>
          <span className="text-border-strong" aria-hidden="true">
            ·
          </span>
          <p className="text-muted-foreground text-xs">
            Opened <RelativeTime iso={issue.created_at} />
            {issue.updated_at !== issue.created_at ? (
              <>
                {" · updated "}
                <RelativeTime iso={issue.updated_at} />
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-8">
        <IssueDetail issue={issue} slug={slug} members={members} labels={labels} />
      </div>
    </PageShell>
  );
}
