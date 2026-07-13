import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SignInInput, SignUpInput } from "@/lib/validations/auth";

/**
 * Auth data layer. Every Supabase auth call in the app happens here.
 *
 * `server-only` makes a build error out of importing this into a Client
 * Component, so credentials can never be dragged into the browser bundle.
 */

/** The signed-in user, or null. */
export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Returns the signed-in user, or null.
 *
 * Uses `getClaims()`, which verifies the JWT signature. `getSession()` would be
 * wrong here: it decodes the cookie without validating it, so a forged cookie
 * would be believed.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) return null;

  const { sub, email } = data.claims;
  if (typeof sub !== "string" || typeof email !== "string") return null;

  return { id: sub, email };
}

/**
 * Like `getCurrentUser`, but throws when there is no session.
 *
 * Use this in any data function that has no meaning for an anonymous caller. It
 * is a guard against *programmer* error, not the security boundary — RLS is the
 * security boundary. It turns "silently returned zero rows" into a loud failure.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export type AuthResult = { ok: true } | { ok: false; message: string };

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Read by the `handle_new_user` trigger to seed profiles.display_name.
      // This lands in `raw_user_meta_data`, which is user-editable — fine for a
      // display name, never acceptable for authorization.
      data: { display_name: input.displayName },
    },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    // Supabase returns the same "Invalid login credentials" for a wrong password
    // and an unknown email, which is what we want: distinguishing them would let
    // an attacker enumerate registered accounts.
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
