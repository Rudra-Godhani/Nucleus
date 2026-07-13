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

/**
 * Workspace mutations. These validate, delegate to the data layer, and decide
 * what to revalidate. No Supabase calls live here — ESLint enforces that.
 */

export type FormState = {
  fieldErrors?: Record<string, string[]>;
  formError?: string;
  /** Set on success, so the UI can show confirmation without a round trip. */
  success?: string;
};

/**
 * A form field that may not be in the DOM at all.
 *
 * `FormData.get()` returns `null` for a missing field and `""` for one that is
 * present but blank. Zod treats both as values rather than absence, so an
 * `.optional()` field still fails validation when handed a `null`. Normalising to
 * `undefined` is what makes "optional" actually mean optional.
 */
function optionalField(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Guarantees that a validation failure is always visible.
 *
 * A field error can only be rendered next to a field that is on screen — and a
 * form with tabs (or any conditional field) can produce an error for a field the
 * user cannot see. That happened here: the invite form's "Shareable Link" tab has
 * no email input, the schema rejected the resulting `null`, and the error had
 * nowhere to render. The button simply did nothing, with no message and no clue —
 * the worst failure mode a form has.
 *
 * So if a submission fails, always surface at least one message at form level.
 */
function withFallbackError(fieldErrors: Record<string, string[] | undefined>): FormState {
  const messages = Object.values(fieldErrors).flatMap((errs) => errs ?? []);
  if (messages.length === 0) return {};

  return {
    fieldErrors: fieldErrors as Record<string, string[]>,
    formError: messages[0],
  };
}

export async function createWorkspaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    slug: optionalField(formData.get("slug")),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors);
  }

  const result = await createWorkspace(parsed.data);
  if (!result.ok) return { formError: result.message };

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
    return withFallbackError(parsed.error.flatten().fieldErrors);
  }

  const result = await createInvite(parsed.data);
  if (!result.ok) return { formError: result.message };

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
    return withFallbackError(parsed.error.flatten().fieldErrors);
  }

  const result = await redeemInvite(parsed.data.code);
  if (!result.ok) return { formError: result.message };

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
