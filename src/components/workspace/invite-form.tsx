"use client";

// 'use client': renders field errors and a success toast from the action result.

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Link2, Mail } from "lucide-react";
import { createInviteAction, type FormState } from "@/app/(app)/actions";
import { FormError, FormField, SubmitButton } from "@/components/shared/form-field";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Create an invite.
 *
 * The two kinds of invite used to be one form with an optional email field, which
 * meant the single most important thing about the invite — whether anyone with the
 * link can use it, or only one named person — was communicated by whether a box
 * happened to be empty. They are separate tabs now, each stating plainly what it
 * produces.
 *
 * `owner` is not offered anywhere: a workspace has exactly one owner, established
 * when it is created. The database would happily accept an owner invite, so
 * leaving it out of the UI is the only thing keeping that rule intact — noted here
 * because it is the sort of omission a later contributor would "fix".
 */
export function InviteForm({ workspaceId, slug }: { workspaceId: string; slug: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(createInviteAction, {});

  // Success is announced as a toast rather than an inline banner: the meaningful
  // result (a new invite) appears in the list below, and a second static message
  // above the form would just push it out of view.
  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state.success]);

  return (
    <Tabs defaultValue="link">
      <TabsList className="w-full">
        <TabsTrigger value="link" className="flex-1 gap-2">
          <Link2 className="size-3.5" aria-hidden="true" />
          Shareable Link
        </TabsTrigger>
        <TabsTrigger value="email" className="flex-1 gap-2">
          <Mail className="size-3.5" aria-hidden="true" />
          By Email
        </TabsTrigger>
      </TabsList>

      <TabsContent value="link" className="mt-5">
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="slug" value={slug} />

          <FormError message={state.formError} />

          <p className="text-muted-foreground text-sm leading-relaxed">
            Creates a code that anyone can use to join, until it expires in 7 days. You can
            revoke it at any time.
          </p>

          <RoleSelect errors={state.fieldErrors?.role} />

          <SubmitButton pendingLabel="Creating…">Create Invite Link</SubmitButton>
        </form>
      </TabsContent>

      <TabsContent value="email" className="mt-5">
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="slug" value={slug} />

          <FormError message={state.formError} />

          <FormField
            name="email"
            label="Email"
            type="email"
            placeholder="teammate@company.com"
            autoComplete="off"
            spellCheck={false}
            hint="Only this address can accept. They will see it when they sign in."
            // Echoed back so a failed submit does not erase the address.
            defaultValue={state.values?.email ?? ""}
            errors={state.fieldErrors?.email}
          />

          <RoleSelect errors={state.fieldErrors?.role} />

          <SubmitButton pendingLabel="Sending…">Send Invite</SubmitButton>
        </form>
      </TabsContent>
    </Tabs>
  );
}

function RoleSelect({ errors }: { errors?: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="role" className="text-xs font-medium">
        Role
      </Label>
      {/* A native <select>. A custom listbox would buy nothing here and cost
          keyboard and mobile behaviour that the platform gives away free. The
          background/colour are set explicitly in globals.css, or Windows dark
          mode paints the options white-on-white. */}
      <select
        id="role"
        name="role"
        defaultValue="member"
        aria-invalid={errors ? true : undefined}
        className="bg-card border-input focus-visible:border-primary focus-visible:ring-primary/25 h-9 w-full rounded-lg border px-3 text-sm transition-[border-color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <option value="member">Member — can create and edit issues</option>
        <option value="admin">Admin — can also invite and remove people</option>
      </select>
      {errors ? <p className="text-destructive text-xs">{errors[0]}</p> : null}
    </div>
  );
}
