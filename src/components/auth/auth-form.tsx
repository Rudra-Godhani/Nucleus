"use client";

// 'use client': useActionState for inline errors and pending state, plus an
// effect that moves focus to the first invalid field after a failed submit.

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";
import type { AuthFormState } from "@/app/(auth)/actions";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
  hint?: string;
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  next,
  footer,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  next?: string;
  footer: { prompt: string; linkText: string; href: string };
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Move focus to the first field that failed. Without this, a keyboard or
  // screen-reader user submits, focus stays on the button, and nothing announces
  // that anything went wrong — the form simply appears to do nothing.
  useEffect(() => {
    const firstInvalid = fields.find((f) => state.fieldErrors?.[f.name]);
    if (!firstInvalid) return;

    formRef.current
      ?.querySelector<HTMLInputElement>(`[name="${firstInvalid.name}"]`)
      ?.focus();
  }, [state, fields]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormError message={state.formError} />

      <div className="space-y-4">
        {fields.map((field) => (
          <FormField
            key={field.name}
            name={field.name}
            label={field.label}
            type={field.type}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            hint={field.hint}
            // Autocorrect on an email field is actively hostile.
            spellCheck={field.type === "email" ? false : undefined}
            // React 19 resets an uncontrolled form after its action runs, even on
            // failure — so without echoing the submission back, a typo in the
            // password would also wipe the email the user had just typed. Passwords
            // are deliberately never echoed (see `formValues`), so they are always
            // retyped, which is the correct trade.
            defaultValue={state.values?.[field.name] ?? ""}
            errors={state.fieldErrors?.[field.name]}
          />
        ))}
      </div>

      <SubmitButton pendingLabel={pendingLabel} className="w-full">
        {submitLabel}
      </SubmitButton>

      <p className="text-muted-foreground text-center text-sm">
        {footer.prompt}{" "}
        <Link
          href={footer.href}
          className="text-foreground hover:text-primary rounded font-medium underline-offset-4 transition-colors hover:underline"
        >
          {footer.linkText}
        </Link>
      </p>
    </form>
  );
}
