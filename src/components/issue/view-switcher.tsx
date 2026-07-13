"use client";

// 'use client': the active view is derived from the current pathname.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Columns3, List } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * List or Board — the same issues, two ways of looking at them.
 *
 * Links, not buttons with state. Each view is a real URL, so it can be bookmarked
 * and shared, and the browser's Back button does the obvious thing. The filters ride
 * along in the query string: switching to the board should not silently widen a list
 * you had narrowed down to one person's work.
 */
export function ViewSwitcher({ base }: { base: string }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  const views = [
    { href: `${base}${suffix}`, label: "List", icon: List, active: pathname === base },
    {
      href: `${base}/board${suffix}`,
      label: "Board",
      icon: Columns3,
      active: pathname === `${base}/board`,
    },
  ];

  return (
    <div className="bg-muted inline-flex items-center rounded-lg p-0.5">
      {views.map((view) => (
        <Link
          key={view.label}
          href={view.href}
          aria-current={view.active ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150",
            view.active
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <view.icon className="size-3.5" aria-hidden="true" />
          {view.label}
        </Link>
      ))}
    </div>
  );
}
