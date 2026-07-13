"use client";

// 'use client': the URL field derives from the name as you type, and the form
// renders per-field errors.

import { useActionState, useEffect, useRef, useState } from "react";
import { createWorkspaceAction, type FormState } from "@/app/(app)/actions";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";
// The same slugify the server falls back to. Importing it rather than repeating
// it means the URL previewed here is always the URL that gets created.
import { slugify } from "@/lib/validations/workspace";

export function CreateWorkspaceForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createWorkspaceAction, {});
  const [slug, setSlug] = useState("");
  // Once the user edits the URL themselves, stop overwriting their choice —
  // silently rewriting what someone just typed is maddening.
  const [slugTouched, setSlugTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const firstInvalid = state.fieldErrors?.name
      ? "name"
      : state.fieldErrors?.slug
        ? "slug"
        : null;
    if (!firstInvalid) return;
    formRef.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <FormError message={state.formError} />

      {/* Echoed back from the failed submission — React 19 resets an uncontrolled
          form after its action runs, so without this a taken-URL error would also
          erase the name the user typed. */}
      <FormField
        name="name"
        label="Workspace Name"
        placeholder="Acme Corp"
        autoComplete="off"
        defaultValue={state.values?.name ?? ""}
        errors={state.fieldErrors?.name}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />

      <FormField
        name="slug"
        label="URL"
        value={slug}
        spellCheck={false}
        autoComplete="off"
        // Shows the real thing they are about to create, not an abstract rule.
        // Left blank, the server derives it from the name — so this is a preview,
        // not a required field.
        hint={slug ? `/w/${slug}` : "Optional — we'll build one from the name."}
        errors={state.fieldErrors?.slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
        }}
      />

      <SubmitButton pendingLabel="Creating…" className="w-full">
        Create Workspace
      </SubmitButton>
    </form>
  );
}
