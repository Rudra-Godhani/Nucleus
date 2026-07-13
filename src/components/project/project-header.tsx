import { PageHeader } from "@/components/shared/page";
import { Identifier } from "@/components/shared/identifier";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";
import { CreateIssueDialog } from "@/components/issue/create-issue-dialog";
import { ViewSwitcher } from "@/components/issue/view-switcher";
import type { loadProjectView } from "@/app/(app)/w/[slug]/p/[key]/project-view";

/**
 * The title block shared by the list and the board.
 *
 * Both views are the same project, so they get the same header — identical name,
 * key, settings and New Issue button in identical places. Switching view should
 * change what is below this line and nothing above it.
 */
export function ProjectHeader({
  view,
  slug,
}: {
  view: Awaited<ReturnType<typeof loadProjectView>>;
  slug: string;
}) {
  const { workspace, project, members, labels, canManage } = view;

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <>
            {canManage ? (
              <ProjectSettingsDialog
                projectId={project.id}
                projectKey={project.key}
                name={project.name}
                description={project.description}
                workspaceId={workspace.id}
                slug={slug}
              />
            ) : null}

            <CreateIssueDialog
              workspaceId={workspace.id}
              projectId={project.id}
              projectKey={project.key}
              slug={slug}
              members={members}
              labels={labels}
            />
          </>
        }
      />

      <div className="mt-3 flex items-center gap-3">
        <Identifier className="text-muted-foreground inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px]">
          {project.key}
        </Identifier>

        <ViewSwitcher base={`/w/${slug}/p/${project.key}`} />
      </div>
    </>
  );
}
