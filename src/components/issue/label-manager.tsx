"use client";

// 'use client': the create form reports server-action errors, and the colour
// swatches are a radio group whose selection is drawn as a ring.

import { useActionState } from "react";
import { toast } from "sonner";
import { Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/empty-state";
import { LabelDot } from "@/components/issue/label-chip";
import { createLabelAction, deleteLabelAction } from "@/app/(app)/w/[slug]/issues-actions";
import { LABEL_COLORS } from "@/lib/validations/issue";
import type { FormState } from "@/app/(app)/form-utils";
import type { Label } from "@/lib/data/labels";

/**
 * Labels, managed in one place.
 *
 * Labels are workspace-scoped, so they are created here rather than inline while
 * filing an issue. Creating one mid-issue is how you end up with "bug", "Bug" and
 * "bugs" — a taxonomy is a decision, and it deserves a screen.
 */
export function LabelManager({
  workspaceId,
  slug,
  labels,
}: {
  workspaceId: string;
  slug: string;
  labels: Label[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createLabelAction(prev, formData);
    if (result.success) toast.success(result.success);
    return result;
  }, {});

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="slug" value={slug} />

        <FormError message={state.formError} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <FormField
              name="name"
              label="Name"
              placeholder="bug"
              autoComplete="off"
              defaultValue={state.values?.name ?? ""}
              errors={state.fieldErrors?.name}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium">Colour</legend>

            {/*
              Real radio inputs, visually hidden. A div with an onClick would work
              too, and would be unreachable by keyboard, unannounced by a screen
              reader, and would not submit without JavaScript. The browser already
              has a control for "pick exactly one of these".
            */}
            <div className="flex h-9 items-center gap-1.5">
              {LABEL_COLORS.map((color, index) => (
                <label
                  key={color}
                  className="focus-within:ring-ring/70 relative flex size-6 cursor-pointer items-center justify-center rounded-full focus-within:ring-2"
                >
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    defaultChecked={
                      state.values?.color ? state.values.color === color : index === 0
                    }
                    className="peer sr-only"
                  />
                  <span
                    className="peer-checked:ring-foreground/70 size-5 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2"
                    style={{ backgroundColor: color }}
                  />
                  <span className="sr-only">{color}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="pt-0 sm:pt-[1.4rem]">
            <SubmitButton pendingLabel="Creating…">Create Label</SubmitButton>
          </div>
        </div>
      </form>

      {labels.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No labels yet"
          description="Labels cut across projects — “bug”, “security”, “needs design” — so they are defined once for the whole workspace."
        />
      ) : (
        <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {labels.map((label) => (
            <li key={label.id} className="flex items-center gap-3 px-3 py-2.5">
              <LabelDot color={label.color} />
              <span className="min-w-0 flex-1 truncate text-sm">{label.name}</span>

              <ConfirmButton
                action={deleteLabelAction}
                hidden={{ labelId: label.id, slug }}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive size-8 p-0"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Delete {label.name}</span>
                  </Button>
                }
                title={`Delete "${label.name}"?`}
                // Says what actually happens, rather than "are you sure?". The join
                // rows cascade, so this quietly reaches every issue carrying it.
                description="It is removed from every issue that carries it. The issues themselves are not affected."
                confirmLabel="Delete Label"
                pendingLabel="Deleting…"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
