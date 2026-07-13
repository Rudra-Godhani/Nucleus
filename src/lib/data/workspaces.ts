import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import type { Database } from "@/lib/types/database.types";
import type { CreateInviteInput, CreateWorkspaceInput } from "@/lib/validations/workspace";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

export type WorkspaceMember = {
  userId: string;
  role: MemberRole;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
};

export type Invite = {
  id: string;
  code: string;
  email: string | null;
  role: MemberRole;
  expiresAt: string;
};

export type PendingInvite = {
  code: string;
  workspaceId: string;
  workspaceName: string;
  role: MemberRole;
  expiresAt: string;
};

/**
 * Every workspace the signed-in user belongs to.
 *
 * There is no `.eq('user_id', ...)` here and there does not need to be: the RLS
 * policy on `workspaces` already restricts this to workspaces the caller is a
 * member of. Adding a filter would imply the query is trusted to enforce that,
 * which is exactly the habit this codebase avoids.
 */
export async function listMyWorkspaces(): Promise<Workspace[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load workspaces: ${error.message}`);
  return data;
}

/** A single workspace by slug, or null if it does not exist *or* the user is not a member. */
export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load workspace: ${error.message}`);
  // Null here means "not found OR not yours" — the two are indistinguishable to
  // the caller by design, so a non-member cannot probe for which slugs exist.
  return data;
}

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; message: string };

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<CreateWorkspaceResult> {
  const user = await requireUser();
  const supabase = await createClient();

  // Note the absence of `.select()` — this is deliberate, and removing it will
  // break workspace creation in a way that looks like a broken RLS policy.
  //
  // Chaining `.select()` makes PostgREST use INSERT ... RETURNING, and Postgres
  // applies the *SELECT* policy to the returned row. The SELECT policy on
  // workspaces requires membership — and membership is created by the
  // `on_workspace_created` AFTER INSERT trigger, which has not fired yet at the
  // moment RETURNING is evaluated. So the creator cannot see their own row for
  // that instant, and the insert fails with:
  //
  //   new row violates row-level security policy for table "workspaces"
  //
  // which is a thoroughly misleading message for what is really a visibility
  // problem. We insert without returning, then read the row back once the trigger
  // has run. supabase/tests/004 guards this.
  const { error } = await supabase
    .from("workspaces")
    .insert({ name: input.name, slug: input.slug, created_by: user.id });

  if (error) {
    // 23505 = unique_violation. The only unique column a user can collide on is
    // the slug, and saying so is far more useful than a generic failure.
    if (error.code === "23505") {
      return { ok: false, message: "That URL is already taken." };
    }
    return { ok: false, message: `Failed to create workspace: ${error.message}` };
  }

  // The trigger has now made this user the owner, so the row is visible to them.
  const workspace = await getWorkspaceBySlug(input.slug);
  if (!workspace) {
    return { ok: false, message: "Workspace was created but could not be loaded." };
  }

  return { ok: true, workspace };
}

/** Everyone in the workspace, with their profile. Non-members get an empty list via RLS. */
export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at, profiles (display_name, email, avatar_url)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load members: ${error.message}`);

  return data.map((row) => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.profiles.display_name,
    email: row.profiles.email,
    avatarUrl: row.profiles.avatar_url,
    joinedAt: row.created_at,
  }));
}

/** The signed-in user's role in a workspace, or null if they are not a member. */
export async function getMyRole(workspaceId: string): Promise<MemberRole | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load role: ${error.message}`);
  return data?.role ?? null;
}

/**
 * Invites for a workspace. RLS restricts this to admins and owners, so a plain
 * member receives an empty list rather than an error.
 */
export async function listInvites(workspaceId: string): Promise<Invite[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, code, email, role, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load invites: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    code: row.code,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
  }));
}

export type CreateInviteResult = { ok: true; invite: Invite } | { ok: false; message: string };

/**
 * Mint an invite. The code is generated by the database (a CSPRNG default on the
 * column) rather than here — an invite code is a bearer token, and generating it
 * in one place makes it impossible to accidentally use a weak source somewhere.
 *
 * RLS rejects this outright if the caller is not an admin or owner.
 */
export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: input.workspaceId,
      email: input.email ?? null,
      role: input.role,
      created_by: user.id,
    })
    .select("id, code, email, role, expires_at")
    .single();

  if (error) {
    // 42501 = insufficient_privilege: RLS said no, i.e. not an admin.
    if (error.code === "42501") {
      return { ok: false, message: "Only admins can invite people." };
    }
    return { ok: false, message: `Failed to create invite: ${error.message}` };
  }

  return {
    ok: true,
    invite: {
      id: data.id,
      code: data.code,
      email: data.email,
      role: data.role,
      expiresAt: data.expires_at,
    },
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("workspace_invites").delete().eq("id", inviteId);
  if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
}

/** Invites addressed to the signed-in user's email, for workspaces they have not joined. */
export async function getMyPendingInvites(): Promise<PendingInvite[]> {
  await requireUser();
  const supabase = await createClient();

  // A plain SELECT cannot answer this: the user is not a member, so RLS hides
  // both the invite and the workspace name. See the invites migration.
  const { data, error } = await supabase.rpc("get_my_pending_invites");

  if (error) throw new Error(`Failed to load invites: ${error.message}`);

  return data.map((row) => ({
    code: row.code,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    role: row.role,
    expiresAt: row.expires_at,
  }));
}

export type RedeemResult = { ok: true; slug: string } | { ok: false; message: string };

/**
 * Join a workspace using an invite code.
 *
 * All the security lives in the database function: it derives the user from the
 * JWT, takes the role and workspace from the invite rather than the caller, and
 * refuses to overwrite an existing membership. See supabase/migrations for why,
 * and supabase/tests/003 for the proof.
 */
export async function redeemInvite(code: string): Promise<RedeemResult> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("redeem_invite", { invite_code: code });

  if (error) {
    // The function returns one deliberately vague message for every rejection so
    // that valid codes cannot be probed for. Pass it through unchanged.
    return { ok: false, message: error.message };
  }

  return { ok: true, slug: data };
}

/**
 * Remove a member. RLS allows this if the caller is an admin/owner, or if they
 * are removing themselves (leaving).
 */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}
