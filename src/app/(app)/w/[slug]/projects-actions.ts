"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProject, deleteProject, getProjectByKey, updateProject } from "@/lib/data/projects";
import {
  createProjectSchema,
  deleteProjectSchema,
  updateProjectSchema,
} from "@/lib/validations/project";
import type { FormState } from "@/app/(app)/actions";
import { formValues, optionalField, withFallbackError } from "@/app/(app)/form-utils";

/**
 * Project mutations. Validate, delegate to the data layer, decide what to
 * revalidate. No Supabase calls here — ESLint enforces that.
 */

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createProjectSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    // Both may legitimately be absent from the DOM, and `FormData.get()` returns
    // null for a missing field — which Zod does not treat as "not provided".
    key: optionalField(formData.get("key")),
    description: optionalField(formData.get("description")),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const result = await createProject(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  const slug = formData.get("slug");
  if (typeof slug !== "string") return { formError: "Missing workspace.", values: formValues(formData) };

  // Straight into the new project. Creating one and being dropped back on a list
  // to hunt for it is busywork.
  redirect(`/w/${slug}/p/${result.project.key}`);
}

export async function updateProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: optionalField(formData.get("description")),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const project = await updateProject(parsed.data);

  const slug = formData.get("slug");
  if (typeof slug === "string") {
    revalidatePath(`/w/${slug}`, "page");
    revalidatePath(`/w/${slug}/p/${project.key}`, "page");
  }

  return { success: "Project updated." };
}

/**
 * Delete a project.
 *
 * The caller must type the project key back to confirm. A project takes every
 * issue in it when it goes, and that is not something a mis-aimed click should be
 * able to do — so this asks for a deliberate act, not just a second click.
 */
export async function deleteProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = deleteProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    confirmKey: formData.get("confirmKey"),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const workspaceId = formData.get("workspaceId");
  const expectedKey = formData.get("projectKey");
  const slug = formData.get("slug");

  if (typeof workspaceId !== "string" || typeof expectedKey !== "string") {
    return { formError: "Missing project details.", values: formValues(formData) };
  }

  // Compared case-insensitively: the point is to prove intent, not to test typing.
  if (parsed.data.confirmKey.toUpperCase() !== expectedKey.toUpperCase()) {
    return { fieldErrors: { confirmKey: [`Type ${expectedKey} to confirm.`] }, values: formValues(formData) };
  }

  // Re-check the project really is in this workspace before deleting. RLS would
  // refuse a foreign project anyway — this turns a silent zero-row delete into an
  // honest error instead.
  const project = await getProjectByKey(workspaceId, expectedKey);
  if (!project || project.id !== parsed.data.projectId) {
    return { formError: "That project no longer exists.", values: formValues(formData) };
  }

  await deleteProject(parsed.data.projectId);

  if (typeof slug === "string") {
    revalidatePath(`/w/${slug}`, "page");
    redirect(`/w/${slug}`);
  }

  return { success: "Project deleted." };
}
