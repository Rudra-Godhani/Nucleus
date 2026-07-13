import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Identifier } from "@/components/shared/identifier";
import type { ProjectSummary } from "@/lib/data/projects";

/**
 * The project list.
 *
 * Each row leads with the key in monospace, because the key is what people say
 * out loud and type into commit messages — it is the project's real name, and the
 * prose name is the label. The counts are the only numbers on the row, so they are
 * tabular: they must not jitter as they change.
 */
export function ProjectList({
  projects,
  slug,
}: {
  projects: ProjectSummary[];
  slug: string;
}) {
  return (
    <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/w/${slug}/p/${project.key}`}
            className="group hover:bg-accent/50 flex items-center gap-3 px-3 py-3 transition-colors duration-150"
          >
            <Identifier className="bg-muted text-muted-foreground flex h-6 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium">
              {project.key}
            </Identifier>

            {/* min-w-0 is what lets the truncation below actually happen. */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{project.name}</p>
              {project.description ? (
                <p className="text-muted-foreground truncate text-xs">{project.description}</p>
              ) : null}
            </div>

            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {project.issueCount === 0 ? (
                "No issues"
              ) : (
                <>
                  {project.openIssueCount} open
                  <span className="text-muted-foreground/50"> / {project.issueCount}</span>
                </>
              )}
            </span>

            <ChevronRight
              className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
