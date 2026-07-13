import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import {
  priorityLabel,
  statusLabel,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/issue-display";
import type { Database } from "@/lib/types/database.types";

/**
 * The activity feed: what happened to an issue, and who did it.
 *
 * The trigger stores raw values — enum members and user ids — because that is what a
 * database should store. Turning them into a sentence happens here rather than in a
 * component, so that "moved this to In Progress" is written once and cannot drift
 * between the issue page, a future notification email, and whatever comes next.
 */

export type ActivityEvent = {
  id: string;
  createdAt: string;
  actor: string | null;
  /** Already in English. The component renders it; it does not decide it. */
  summary: string;
};

type ActivityRow = {
  id: string;
  kind: string;
  data: Database["public"]["Tables"]["activity"]["Row"]["data"];
  created_at: string;
  profiles: { display_name: string } | null;
};

/** The trigger writes `data` as jsonb, so its shape is not in the generated types. */
function field(data: unknown, key: string): string | null {
  if (typeof data !== "object" || data === null) return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/**
 * One event, in English.
 *
 * `names` maps a user id to a display name, because `assignee_changed` stores ids —
 * the feed must survive somebody being renamed, and it must not go stale the moment
 * they are.
 */
function summarize(row: ActivityRow, names: Map<string, string>): string {
  const from = field(row.data, "from");
  const to = field(row.data, "to");

  switch (row.kind) {
    case "created":
      return "opened this issue";

    case "status_changed":
      return `moved this to ${statusLabel(to as IssueStatus)}`;

    case "priority_changed":
      return to === "none"
        ? "cleared the priority"
        : `set priority to ${priorityLabel(to as IssuePriority)}`;

    case "assignee_changed":
      if (!to) return "unassigned this";
      return `assigned this to ${names.get(to) ?? "someone"}`;

    case "title_changed":
      // The old title, not the new one: the new title is at the top of the page, in
      // large type. What the reader cannot otherwise recover is what it used to say.
      return from ? `renamed this from “${from}”` : "renamed this";

    default:
      // A `kind` this build does not know about — a newer trigger, an older client.
      // Better a vague line than a blank one or a crash.
      return "updated this issue";
  }
}

export async function listActivity(
  issueId: string,
  /** Workspace members, for resolving the ids in `assignee_changed`. */
  members: { userId: string; displayName: string }[],
): Promise<ActivityEvent[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity")
    .select("id, kind, data, created_at, profiles (display_name)")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load activity: ${error.message}`);

  const names = new Map(members.map((member) => [member.userId, member.displayName]));

  return (data as ActivityRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    // Null when the change was not made by a signed-in user — a migration, a proof,
    // a hand-run SQL statement. `actor_id` is nullable for exactly that reason.
    actor: row.profiles?.display_name ?? null,
    summary: summarize(row, names),
  }));
}
