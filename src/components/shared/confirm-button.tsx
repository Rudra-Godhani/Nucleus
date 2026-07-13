"use client";

// 'use client': a dialog with open state, and a pending state on the confirm.

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A button that asks before doing something irreversible.
 *
 * Removing a teammate, revoking an invite and leaving a workspace all used to be
 * single-click, no-questions-asked, no undo. Every destructive action in the app
 * routes through here now.
 *
 * The action itself stays a real <form action={...}>, so the mutation still runs
 * server-side and works without JavaScript; the dialog only gates it.
 */
export function ConfirmButton({
  action,
  hidden,
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  variant = "destructive",
}: {
  /** The server action to run on confirm. */
  action: (formData: FormData) => Promise<void>;
  /** Hidden fields carried into the action. */
  hidden?: Record<string, string>;
  trigger: React.ReactNode;
  title: string;
  /** Say what will actually happen, and whether it can be undone. */
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  variant?: "destructive" | "default";
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <form action={action}>
          {Object.entries(hidden ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <ConfirmSubmit
              label={confirmLabel}
              pendingLabel={pendingLabel}
              variant={variant}
            />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Split out because useFormStatus only sees the form when it is called from a
 * component *inside* it.
 *
 * Rendered as AlertDialogAction with `asChild` so it keeps the dialog's keyboard
 * semantics (Enter confirms, Escape cancels) while still being a real submit
 * button.
 */
function ConfirmSubmit({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "destructive" | "default";
}) {
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction asChild>
      <Button
        type="submit"
        disabled={pending}
        className={cn(
          "gap-2",
          variant === "destructive" &&
            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        )}
      >
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </Button>
    </AlertDialogAction>
  );
}
