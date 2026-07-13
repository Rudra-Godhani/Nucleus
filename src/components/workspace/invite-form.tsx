"use client";

// 'use client': renders per-field errors and a success message from the action.

import { useActionState } from "react";
import { createInviteAction, type FormState } from "@/app/(app)/actions";
import {
  FormError,
  FormField,
  FormSuccess,
  SubmitButton,
} from "@/components/shared/form-field";
import { Label } from "@/components/ui/label";

/**
 * Create an invite.
 *
 * Leaving the email blank produces a shareable code that anyone holding it can
 * use until it expires. Filling it in produces a single-use invite that only that
 * person's account can redeem.
 *
 * `owner` is not offered: a workspace has exactly one owner, established when it
 * is created. The database would accept an owner invite, but exposing it here
 * would be a route around that rule.
 */
export function InviteForm({ workspaceId, slug }: { workspaceId: string; slug: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(createInviteAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="slug" value={slug} />

      <FormError message={state.formError} />
      <FormSuccess message={state.success} />

      <FormField
        name="email"
        label="Email (optional)"
        type="email"
        placeholder="teammate@company.com"
        autoComplete="off"
        hint="Leave blank to create a shareable code instead."
        errors={state.fieldErrors?.email}
      />

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <option value="member">Member</option>
          <option value="admin">Admin — can invite and remove people</option>
        </select>
      </div>

      <SubmitButton pendingLabel="Creating…">Create invite</SubmitButton>
    </form>
  );
}
