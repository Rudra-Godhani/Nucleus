import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";
import { requireUser } from "@/lib/data/auth";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * The signed-in user's profile.
 *
 * Returns null if the row is missing, which should not happen — the
 * `handle_new_user` trigger creates it at signup. Callers should treat null as
 * "profile not ready yet" rather than "no such user".
 */
export async function getMyProfile(): Promise<Profile | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    // Redundant with RLS, which already restricts this to the caller's own row.
    // Kept because it makes the query's intent obvious to the next reader, and
    // because relying on RLS to do a WHERE clause's job reads like an accident.
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data;
}

/**
 * Updates the signed-in user's display name.
 *
 * There is deliberately no `userId` parameter. If a caller could pass one, this
 * function's safety would depend on every caller passing the right value; as
 * written, it is impossible to aim at someone else's row. RLS would reject it
 * anyway, but the API should not invite the mistake.
 */
export async function updateMyDisplayName(displayName: string): Promise<Profile> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return data;
}
