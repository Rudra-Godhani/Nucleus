"use client";

// 'use client': the clipboard API and the confirmation both need the browser.

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Copy to clipboard, with the confirmation on the button itself.
 *
 * The icon swap is the feedback — a toast for something this small would be
 * heavier than the action. The label is announced politely so a screen-reader user
 * gets the same confirmation a sighted user gets from the tick.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Reset after a beat, and clear the timer if we unmount first — otherwise React
  // warns about setting state on a component that is gone.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be refused outright (insecure context, denied
          // permission). Failing silently would leave the user tapping a button
          // that appears to do nothing, so say so — the code is on screen and can
          // still be selected by hand.
          toast.error("Couldn't copy. Select the code and copy it manually.");
        }
      }}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}
