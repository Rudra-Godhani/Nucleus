"use client";

// 'use client' because these are used inside forms that render server-action
// errors and a pending state, which requires hooks.

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The error/aria wiring for a form field, in one place.
 *
 * Every field needs the same three things — a label bound to the input, an error
 * message with an id, and `aria-describedby` pointing at it — and getting one of
 * them wrong is invisible until someone uses a screen reader. Doing it once here
 * means it cannot rot per-form.
 */
export function FormField({
  name,
  label,
  errors,
  hint,
  ...inputProps
}: {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
} & Omit<React.ComponentProps<typeof Input>, "name">) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [errors ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {errors ? (
        <p id={errorId} className="text-destructive text-sm">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** A form-level error (bad credentials, RLS refusal) rather than a field error. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
    >
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
      {message}
    </p>
  );
}

/**
 * useFormStatus reads the state of the nearest enclosing form, so it must live in
 * a child of that form — not in the component that renders it.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: { pendingLabel: string } & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
