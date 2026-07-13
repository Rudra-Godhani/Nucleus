import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import type { CreateLabelInput } from "@/lib/validations/issue";

export type Label = { id: string; name: string; color: string };

/** Labels are workspace-scoped, not project-scoped: "bug" means the same thing everywhere. */
export async function listLabels(workspaceId: string): Promise<Label[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("labels")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load labels: ${error.message}`);
  return data;
}

export type CreateLabelResult = { ok: true; label: Label } | { ok: false; message: string };

export async function createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("labels")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      color: input.color,
    })
    .select("id, name, color")
    .single();

  if (error) {
    // 23505 = unique_violation on (workspace_id, name). Two labels called "bug"
    // would be indistinguishable on a card.
    if (error.code === "23505") {
      return { ok: false, message: `A label called "${input.name}" already exists.` };
    }
    return { ok: false, message: `Failed to create label: ${error.message}` };
  }

  return { ok: true, label: data };
}

/**
 * Delete a label. It disappears from every issue that carried it — the join rows
 * cascade — which is why this is offered only where that is obvious.
 */
export async function deleteLabel(labelId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("labels").delete().eq("id", labelId);
  if (error) throw new Error(`Failed to delete label: ${error.message}`);
}
