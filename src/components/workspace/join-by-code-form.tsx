"use client";

// 'use client': renders the server action's rejection inline.

import { useActionState } from "react";
import { redeemInviteAction, type FormState } from "@/app/(app)/actions";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";

/**
 * Join a workspace with a shared code.
 *
 * The error shown here is whatever the database function returned, which is
 * deliberately vague — "This invite is invalid or has expired" — for every failure
 * mode: wrong code, expired code, someone else's invite. Being more specific would
 * turn this form into an oracle for probing valid codes.
 */
export function JoinByCodeForm({ defaultCode }: { defaultCode?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(redeemInviteAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.formError} />

      <FormField
        name="code"
        label="Invite Code"
        defaultValue={defaultCode}
        placeholder="Paste your code…"
        // An invite code is an opaque token — autocorrect and spellcheck would
        // mangle it, and a password manager has no business here.
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="font-mono"
        errors={state.fieldErrors?.code}
      />

      <SubmitButton pendingLabel="Joining…" variant="outline" className="w-full">
        Join Workspace
      </SubmitButton>
    </form>
  );
}
