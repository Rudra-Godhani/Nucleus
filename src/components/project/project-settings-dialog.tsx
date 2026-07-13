"use client";

// 'use client': dialog state, plus inline errors and toasts from two actions.

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";
import {
  deleteProjectAction,
  updateProjectAction,
} from "@/app/(app)/w/[slug]/projects-actions";
import type { FormState } from "@/app/(app)/form-utils";

/**
 * Project settings: rename, and delete.
 *
 * The key is shown but not editable. Issue identifiers (PLAT-14) get written into
 * commit messages, pull requests and conversations; changing the prefix would
 * silently invalidate every reference to them that lives outside this database.
 * That is explained in the UI rather than left as a mysterious disabled field.
 */
export function ProjectSettingsDialog({
  projectId,
  projectKey,
  name,
  description,
  workspaceId,
  slug,
}: {
  projectId: string;
  projectKey: string;
  name: string;
  description: string | null;
  workspaceId: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);

  // The toast and the close happen *inside* the action, not in an effect
  // watching its result. Reacting to your own state change with another state
  // change is a cascading render — and the React Compiler lint rejects it
  // outright. An action is already a transition, so this is where a side effect
  // belongs.
  const [updateState, updateAction] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await updateProjectAction(prev, formData);
      if (result.success) {
        toast.success(result.success);
        setOpen(false);
      }
      return result;
    },
    {},
  );

  const [deleteState, deleteAction] = useActionState<FormState, FormData>(
    deleteProjectAction,
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="size-3.5" aria-hidden="true" />
          Settings
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            Rename this project, or delete it and everything in it.
          </DialogDescription>
        </DialogHeader>

        <form action={updateAction} className="space-y-4" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="slug" value={slug} />

          <FormError message={updateState.formError} />

          <FormField
            name="name"
            label="Name"
            defaultValue={name}
            autoComplete="off"
            errors={updateState.fieldErrors?.name}
          />

          <FormField
            name="description"
            label="Description"
            defaultValue={description ?? ""}
            placeholder="What belongs in this project?"
            autoComplete="off"
            errors={updateState.fieldErrors?.description}
          />

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Key</p>
            <p
              translate="no"
              className="bg-muted text-muted-foreground rounded-lg border px-3 py-2 font-mono text-sm"
            >
              {projectKey}
            </p>
            <p className="text-muted-foreground text-xs">
              The key cannot be changed — issue identifiers like{" "}
              <span translate="no" className="font-mono">
                {projectKey}-1
              </span>{" "}
              are referenced outside Nucleus, in commits and conversations.
            </p>
          </div>

          <div className="flex justify-end">
            <SubmitButton pendingLabel="Saving…">Save Changes</SubmitButton>
          </div>
        </form>

        <Separator />

        <form action={deleteAction} className="space-y-3" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="projectKey" value={projectKey} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="slug" value={slug} />

          <div className="space-y-1">
            <p className="text-destructive text-sm font-medium">Delete this project</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Every issue in it is deleted too. This cannot be undone.
            </p>
          </div>

          <FormError message={deleteState.formError} />

          {/*
            Typing the key back, rather than a second click. Deleting a project
            takes other people's work with it — that should require a deliberate
            act, not a reflex. The server re-checks this; the field is not the
            security boundary, RLS is (admins only).
          */}
          <FormField
            name="confirmKey"
            label={`Type ${projectKey} to confirm`}
            placeholder={projectKey}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            errors={deleteState.fieldErrors?.confirmKey}
          />

          <div className="flex justify-end">
            <SubmitButton
              pendingLabel="Deleting…"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Project
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
