"use client";

// 'use client' because this form needs useActionState/useFormStatus to render
// per-field errors and a pending state without a full page reload. The pages
// that render it stay Server Components.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/app/(auth)/actions";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
};

type AuthFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  /** Where to send the user after success. Validated server-side. */
  next?: string;
  footer: { prompt: string; linkText: string; href: string };
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  // useFormStatus must be called from a component *inside* the form, not the one
  // that renders it — hence the separate component.
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  next,
  footer,
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.formError ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {state.formError}
        </p>
      ) : null}

      {fields.map((field) => {
        const errors = state.fieldErrors?.[field.name];
        const errorId = `${field.name}-error`;

        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              aria-invalid={errors ? true : undefined}
              aria-describedby={errors ? errorId : undefined}
            />
            {errors ? (
              <p id={errorId} className="text-destructive text-sm">
                {errors[0]}
              </p>
            ) : null}
          </div>
        );
      })}

      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />

      <p className="text-muted-foreground text-center text-sm">
        {footer.prompt}{" "}
        <Link href={footer.href} className="text-foreground underline underline-offset-4">
          {footer.linkText}
        </Link>
      </p>
    </form>
  );
}
