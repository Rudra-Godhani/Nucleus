"use client";

// 'use client': the slug field auto-fills from the name as you type, and the form
// renders per-field validation errors — both need state.

import { useActionState, useState } from "react";
import { createWorkspaceAction, type FormState } from "@/app/(app)/actions";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";

/**
 * Turns "Acme Corp!" into "acme-corp". This is a *convenience* only — the server
 * re-validates with the same rules as the database CHECK constraint, so a user
 * who edits the field by hand cannot get a bad slug through.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function CreateWorkspaceForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createWorkspaceAction, {});
  const [slug, setSlug] = useState("");
  // Once the user edits the slug themselves, stop overwriting their choice.
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.formError} />

      <FormField
        name="name"
        label="Workspace name"
        placeholder="Acme Corp"
        autoComplete="off"
        errors={state.fieldErrors?.name}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />

      <FormField
        name="slug"
        label="URL"
        value={slug}
        hint={slug ? `nucleus.app/w/${slug}` : "Lowercase letters, numbers and dashes."}
        errors={state.fieldErrors?.slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
        }}
      />

      <SubmitButton pendingLabel="Creating…" className="w-full">
        Create workspace
      </SubmitButton>
    </form>
  );
}
