"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createIssue, deleteIssue, setIssueStatus, updateIssue } from "@/lib/data/issues";
import { createLabel, deleteLabel } from "@/lib/data/labels";
import {
  createIssueSchema,
  createLabelSchema,
  deleteIssueSchema,
  deleteLabelSchema,
  setIssueStatusSchema,
  updateIssueSchema,
} from "@/lib/validations/issue";
import {
  formValues,
  optionalField,
  withFallbackError,
  type FormState,
} from "@/app/(app)/form-utils";

/**
 * Issue mutations. Validate, delegate to the data layer, decide what to
 * revalidate. No Supabase calls here — ESLint enforces that.
 */

/**
 * Labels arrive as repeated `labelIds` fields (one per checked box), so they need
 * `getAll`, not `get`. `get` would silently keep only the first one — the kind of
 * bug that looks like "the second label didn't save".
 */
function labelIds(formData: FormData): string[] {
  return formData.getAll("labelIds").filter((v): v is string => typeof v === "string");
}

export async function createIssueAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createIssueSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: optionalField(formData.get("description")),
    status: optionalField(formData.get("status")),
    priority: optionalField(formData.get("priority")),
    // An unassigned issue submits "", which is a deliberate choice, not an error.
    assigneeId: formData.get("assigneeId") ?? "",
    labelIds: labelIds(formData),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const result = await createIssue(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  const slug = formData.get("slug");
  const projectKey = formData.get("projectKey");
  if (typeof slug === "string" && typeof projectKey === "string") {
    revalidatePath(`/w/${slug}/p/${projectKey}`, "page");
  }

  return { success: `${result.issue.identifier} created.` };
}

export async function updateIssueAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateIssueSchema.safeParse({
    issueId: formData.get("issueId"),
    title: formData.get("title"),
    description: optionalField(formData.get("description")),
    status: formData.get("status"),
    priority: formData.get("priority"),
    assigneeId: formData.get("assigneeId") ?? "",
    labelIds: labelIds(formData),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const issue = await updateIssue(parsed.data);

  const slug = formData.get("slug");
  if (typeof slug === "string") {
    revalidatePath(`/w/${slug}/p/${issue.projectKey}`, "page");
    revalidatePath(`/w/${slug}/p/${issue.projectKey}/${issue.number}`, "page");
  }

  return { success: `${issue.identifier} saved.` };
}

/**
 * Move an issue to a status.
 *
 * Returns void rather than form state: this is fired from a menu and from the board
 * (Step 7), where there is no form to report back into. Failures surface as a
 * thrown error, which the route's error boundary catches.
 */
export async function setIssueStatusAction(formData: FormData): Promise<void> {
  const parsed = setIssueStatusSchema.safeParse({
    issueId: formData.get("issueId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await setIssueStatus(parsed.data.issueId, parsed.data.status);

  const slug = formData.get("slug");
  const projectKey = formData.get("projectKey");
  if (typeof slug === "string" && typeof projectKey === "string") {
    revalidatePath(`/w/${slug}/p/${projectKey}`, "page");
  }
}

export async function deleteIssueAction(formData: FormData): Promise<void> {
  const parsed = deleteIssueSchema.safeParse({ issueId: formData.get("issueId") });
  if (!parsed.success) return;

  await deleteIssue(parsed.data.issueId);

  const slug = formData.get("slug");
  const projectKey = formData.get("projectKey");
  if (typeof slug === "string" && typeof projectKey === "string") {
    revalidatePath(`/w/${slug}/p/${projectKey}`, "page");
    // The issue's own page no longer exists, so anyone standing on it must be
    // moved off before it 404s underneath them.
    redirect(`/w/${slug}/p/${projectKey}`);
  }
}

export async function createLabelAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createLabelSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    color: optionalField(formData.get("color")),
  });

  if (!parsed.success) {
    return withFallbackError(parsed.error.flatten().fieldErrors, formData);
  }

  const result = await createLabel(parsed.data);
  if (!result.ok) return { formError: result.message, values: formValues(formData) };

  const slug = formData.get("slug");
  // "layout", not "page": a label is offered by the create-issue dialog and the
  // filter bar on every project page, so a new one has to reach all of them.
  if (typeof slug === "string") revalidatePath(`/w/${slug}`, "layout");

  return { success: `Label "${result.label.name}" created.` };
}

export async function deleteLabelAction(formData: FormData): Promise<void> {
  const parsed = deleteLabelSchema.safeParse({ labelId: formData.get("labelId") });
  if (!parsed.success) return;

  await deleteLabel(parsed.data.labelId);

  const slug = formData.get("slug");
  if (typeof slug === "string") revalidatePath(`/w/${slug}`, "layout");
}
