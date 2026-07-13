"use client";

// 'use client': the query lives in the URL, and typing has to be debounced before it
// gets written there.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The search box.
 *
 * The query is in the URL, like every other piece of view state in this app: a search
 * result is a thing you can link someone to, and Back returns you to what you searched
 * for rather than to a blank box.
 *
 * Typing is debounced before it is written there. Without it, every keystroke is a
 * history entry and a round trip — "auth" would take four navigations to type, and
 * pressing Back four times would spell it backwards.
 */
const DEBOUNCE_MS = 250;

export function SearchInput({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const initial = params.get("q") ?? "";

  // The input is controlled so it can be cleared by the button, but the URL is only
  // updated on a pause — so this holds what has been TYPED, which is briefly ahead of
  // what has been SEARCHED.
  const [value, setValue] = useState(initial);

  // What is currently in the URL. Used to avoid pushing a navigation that would not
  // change anything — which would otherwise happen on every mount.
  const committed = useRef(initial);

  useEffect(() => {
    if (value === committed.current) return;

    const timer = setTimeout(() => {
      committed.current = value;
      const query = value.trim() ? `?q=${encodeURIComponent(value)}` : "";

      // `replace`, not `push`: each keystroke would otherwise be its own history
      // entry. And `scroll: false`, so results updating underneath you does not throw
      // you back to the top of the page.
      router.replace(`${basePath}${query}`, { scroll: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, basePath, router]);

  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />

      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        // The search page exists to be typed into. Autofocus is usually a nuisance —
        // it steals the caret from whatever the user was doing — but this page has no
        // other purpose, so the alternative is that the first thing every visitor does
        // is click the box.
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-label="Search issues"
        placeholder="Search issues…"
        className={cn(
          "bg-card border-input h-11 w-full rounded-xl border pr-10 pl-9 text-sm",
          "transition-[border-color,box-shadow] duration-150",
          "focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-[3px] focus-visible:outline-none",
          // `type="search"` is kept for its semantics — a screen reader announces it as
          // a search field — but WebKit also draws its own clear button inside it, so
          // the box ended up with two ✕s side by side. Suppress theirs; ours is the one
          // that is styled, keyboard-labelled, and actually clears the URL.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setValue("")}
          className="text-muted-foreground absolute top-1/2 right-1.5 size-8 -translate-y-1/2 p-0"
        >
          <X className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Clear search</span>
        </Button>
      ) : null}
    </div>
  );
}
