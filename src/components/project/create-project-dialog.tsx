"use client";

// 'use client': a dialog with open state, and a key field that derives from the
// name as you type.

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";
import { createProjectAction } from "@/app/(app)/w/[slug]/projects-actions";
import type { FormState } from "@/app/(app)/form-utils";
// The same derivation the server falls back to. Importing it rather than
// repeating it means the key previewed here is the key that gets created.
import { deriveProjectKey } from "@/lib/validations/project";

export function CreateProjectDialog({
  workspaceId,
  slug,
  trigger,
}: {
  workspaceId: string;
  slug: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(createProjectAction, {});
  const [key, setKey] = useState("");
  // Once the user edits the key themselves, stop overwriting it.
  const [keyTouched, setKeyTouched] = useState(false);

  // No effect needed to keep the dialog open on failure: it only closes when
  // something closes it, and a failed action just re-renders with the error in
  // place. A successful create redirects, which unmounts the dialog anyway.

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="size-3.5" aria-hidden="true" />
            New Project
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Projects group related issues. Each one gets a short key used in issue
            identifiers.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="slug" value={slug} />

          <FormError message={state.formError} />

          {/*
            `defaultValue` from the echoed submission, not an empty field.
            React 19 resets an uncontrolled form once the action completes — even
            when it *failed* — so without this, a duplicate-key error would hand
            the user a blank form and make them retype everything. A reset returns
            each input to its value attribute, which is what defaultValue sets.
          */}
          <FormField
            name="name"
            label="Name"
            placeholder="Platform"
            autoComplete="off"
            autoFocus
            defaultValue={state.values?.name ?? ""}
            errors={state.fieldErrors?.name}
            onChange={(e) => {
              if (!keyTouched) setKey(deriveProjectKey(e.target.value));
            }}
          />

          <FormField
            name="key"
            label="Key"
            value={key}
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            // Shows the identifier they will actually live with, not an abstract
            // rule. Left blank, the server derives it from the name.
            hint={key ? `Issues will be numbered ${key}-1, ${key}-2, …` : "2–6 letters or numbers."}
            errors={state.fieldErrors?.key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value.toUpperCase());
            }}
          />

          <FormField
            name="description"
            label="Description (optional)"
            placeholder="What belongs in this project?"
            autoComplete="off"
            defaultValue={state.values?.description ?? ""}
            errors={state.fieldErrors?.description}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Creating…">Create Project</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
