import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { listLabels } from "@/lib/data/labels";
import { PageHeader, PageShell } from "@/components/shared/page";
import { LabelManager } from "@/components/issue/label-manager";

export const metadata: Metadata = { title: "Labels" };

export default async function LabelsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const labels = await listLabels(workspace.id);

  return (
    <PageShell className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <PageHeader
          title="Labels"
          description="Shared across every project in this workspace. Any member can add or remove them."
        />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <LabelManager workspaceId={workspace.id} slug={slug} labels={labels} />
      </div>
    </PageShell>
  );
}
