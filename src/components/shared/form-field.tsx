"use client";

// 'use client': these render server-action errors and pending state, which needs
// useFormStatus.

import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * The label/error/aria wiring lives here once. Every field needs a label bound to
 * its input, an error with an id, and `aria-describedby` pointing at it — and a
 * mistake in any of the three is invisible until someone uses a screen reader.
 * Centralising it means it cannot rot per-form.
 */

export function FormField({
  name,
  label,
  errors,
  hint,
  className,
  ...inputProps
}: {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
} & React.ComponentProps<"input">) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const invalid = Boolean(errors?.length);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium">
        {label}
      </Label>

      <input
        id={name}
        name={name}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined
        }
        className={cn(
          "bg-card border-input h-9 w-full rounded-lg border px-3 text-sm",
          "placeholder:text-muted-foreground/60",
          // Only the properties that actually change — `transition: all` would
          // animate layout as well as paint.
          "transition-[border-color,box-shadow] duration-150",
          "focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-[3px] focus-visible:outline-none",
          invalid &&
            "border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...inputProps}
      />

      {hint && !invalid ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {invalid ? (
        <p id={errorId} className="text-destructive flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A failure that belongs to the submission as a whole rather than one field.
 *
 * `aria-live="polite"` because this appears *after* the user submits — a screen
 * reader would otherwise never announce it, and the user would be left staring at
 * a form that silently did nothing.
 */
export function FormError({ message }: { message?: string }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {message ? (
        <p
          role="alert"
          className="border-destructive/25 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{message}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The submit button.
 *
 * Stays enabled until the request actually starts (disabling it earlier makes a
 * form feel broken when validation is the thing that failed), then swaps to a
 * spinner. The label is specific — "Create Workspace", never "Continue".
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  ...props
}: { pendingLabel: string } & React.ComponentProps<typeof Button>) {
  // useFormStatus reads the nearest enclosing <form>, so this must be a child of
  // it — not of the component that renders the form.
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={cn("gap-2", className)} {...props}>
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
