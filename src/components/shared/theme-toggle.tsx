"use client";

// 'use client': reads and writes the persisted theme.

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * True once we are running in the browser.
 *
 * The server cannot know the user's theme, so painting the active option during
 * SSR would guarantee a hydration mismatch. `useSyncExternalStore` gives a
 * different snapshot on server and client without a setState-in-effect, which
 * cascades an extra render (and which the React Compiler lint rejects outright).
 */
const emptySubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true, // client
    () => false, // server
  );

/**
 * A segmented control rather than a cycling icon button.
 *
 * A single toggle cannot express three states, and it hides which one is active
 * — you have to click it to find out. Three explicit options cost one extra row
 * in a menu and remove the guesswork.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("bg-muted/60 flex items-center gap-0.5 rounded-lg p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "text-muted-foreground flex size-7 items-center justify-center rounded-sm transition-colors duration-150",
              "hover:text-foreground",
              active && "bg-card text-foreground shadow-xs",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
