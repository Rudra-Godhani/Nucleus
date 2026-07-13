"use server";

import { redirect } from "next/navigation";
import { signIn, signOut, signUp } from "@/lib/data/auth";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";
import { formValues } from "@/app/(app)/form-utils";

/**
 * Server Actions for auth.
 *
 * These orchestrate — validate the input, call the data layer, decide where to
 * send the user. They contain no Supabase calls of their own; ESLint enforces
 * that.
 */

/**
 * What the form gets back. `fieldErrors` is keyed by field name so each input can
 * render its own message; `formError` is for failures that belong to the
 * submission as a whole (bad credentials, provider outage).
 *
 * `values` echoes the submission back. React 19 resets an uncontrolled form once
 * its action completes — including when it failed — so without this, a wrong
 * password would also wipe the email address the user had just typed. `formValues`
 * deliberately never echoes a password field.
 */
export type AuthFormState = {
  fieldErrors?: Record<string, string[]>;
  formError?: string;
  values?: Record<string, string>;
};

/**
 * `next` is a caller-supplied redirect target, so it is an open-redirect risk.
 * Only same-origin absolute paths are allowed: "/board" is fine,
 * "//evil.com" and "https://evil.com" are not.
 */
function safeRedirectTarget(next: FormDataEntryValue | null): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: formValues(formData) };
  }

  const result = await signUp(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  // `redirect` throws internally to unwind — it must be outside any try/catch.
  redirect(safeRedirectTarget(formData.get("next")));
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: formValues(formData) };
  }

  const result = await signIn(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  redirect(safeRedirectTarget(formData.get("next")));
}

export async function signOutAction(): Promise<never> {
  await signOut();
  redirect("/login");
}
