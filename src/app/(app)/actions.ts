"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import {
  createInvite,
  createWorkspace,
  redeemInvite,
  removeMember,
  revokeInvite,
} from "@/lib/data/workspaces";
import {
  createInviteSchema,
  createWorkspaceSchema,
  redeemInviteSchema,
  removeMemberSchema,
} from "@/lib/validations/workspace";
import {
  formValues,
  optionalField,
  withFallbackError,
  type FormState,
} from "@/app/(app)/form-utils";

/**
 * Workspace mutations. These validate, delegate to the data layer, and decide
 * what to revalidate. No Supabase calls live here — ESLint enforces that.
 *
 * `FormState` and the form helpers live in `form-utils.ts` rather than here: a
 * `"use server"` file may only export async functions, because every export
 * becomes a callable server endpoint.
 */

export type { FormState } from "@/app/(app)/form-utils";

export async function createWorkspaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    slug: optionalField(formData.get("slug")),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const result = await createWorkspace(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  // redirect() throws to unwind, so it must sit outside any try/catch.
  redirect(`/w/${result.workspace.slug}`);
}

export async function createInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createInviteSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    // `optionalField`, not a bare `.get()`. The "Shareable Link" tab has no email
    // input at all, so `formData.get("email")` returns null — and null is not
    // `undefined` to Zod. It failed validation on a field that was not on screen,
    // so the error had nowhere to render and the button silently did nothing.
    email: optionalField(formData.get("email")),
    role: optionalField(formData.get("role")),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const result = await createInvite(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  // Revalidate only on success. Doing it before checking `result.ok` would
  // re-render the page underneath a failed submission and throw away the error
  // message the user needs to see — which is precisely how a broken invite insert
  // went unnoticed during development.
  const slug = formData.get("slug");
  if (typeof slug === "string") revalidatePath(`/w/${slug}/members`, "page");

  return {
    success: parsed.data.email
      ? `Invite created for ${parsed.data.email}. They will see it when they sign in.`
      : "Invite link created. Copy the code below.",
  };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const inviteId = formData.get("inviteId");
  const slug = formData.get("slug");
  if (typeof inviteId !== "string") return;

  await revokeInvite(inviteId);
  if (typeof slug === "string") revalidatePath(`/w/${slug}/members`);
}

export async function redeemInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = redeemInviteSchema.safeParse({ code: formData.get("code") });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const result = await redeemInvite(parsed.data.code);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  redirect(`/w/${result.slug}`);
}

/**
 * Accept an invite already addressed to you, from the workspace picker.
 *
 * Separate from `redeemInviteAction` because that one is driven by
 * `useActionState` and returns form state, whereas a plain <form action> must
 * return void. Same validation, same data-layer call.
 */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const parsed = redeemInviteSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return;

  const result = await redeemInvite(parsed.data.code);
  // If it failed, fall through: the picker re-renders and the invite is either
  // gone or still listed, which is the honest outcome either way.
  if (!result.ok) return;

  redirect(`/w/${result.slug}`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const parsed = removeMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return;

  const user = await requireUser();
  const isLeaving = parsed.data.userId === user.id;

  await removeMember(parsed.data.workspaceId, parsed.data.userId);

  const slug = formData.get("slug");

  // Leaving is different from removing someone else: the page you are standing on
  // is the one you just lost access to. Revalidating it would re-render a members
  // list the caller can no longer read — a blank screen at best, a 404 at worst.
  // Send them somewhere that still exists.
  if (isLeaving) {
    redirect("/workspaces");
  }

  if (typeof slug === "string") revalidatePath(`/w/${slug}/members`, "page");
}
