"use client";

// 'use client': the clipboard API and the "Copied" confirmation both need the
// browser.

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  // Reset the confirmation after a moment, and clear the timer if the component
  // unmounts first — otherwise React warns about setting state on a gone component.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be denied (insecure context, permissions).
          // Nothing useful to do — the code is on screen and can be selected.
        }
      }}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
