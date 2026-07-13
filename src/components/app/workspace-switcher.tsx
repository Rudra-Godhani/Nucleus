"use client";

// 'use client': a dropdown with open/close state.

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type WorkspaceOption = { id: string; name: string; slug: string };

/**
 * Switch workspaces from the header.
 *
 * Previously the only way to change workspace was to navigate back to a picker
 * page — a dead end that made multi-workspace use feel like a mistake. The
 * current workspace is always visible here, and switching is one click from
 * anywhere in the app.
 *
 * Entries are `<Link>`s inside the menu, not click handlers, so ⌘-click and
 * middle-click open a workspace in a new tab like any other link.
 */
export function WorkspaceSwitcher({
  workspaces,
  currentSlug,
}: {
  workspaces: WorkspaceOption[];
  currentSlug?: string;
}) {
  const current = workspaces.find((w) => w.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-accent flex h-8 max-w-52 items-center gap-1.5 rounded-lg px-2 text-sm font-medium",
          "transition-colors duration-150 outline-none",
          "focus-visible:ring-ring/70 focus-visible:ring-2",
        )}
        aria-label={current ? `Workspace: ${current.name}. Switch workspace` : "Select workspace"}
      >
        {/* min-w-0 is what actually allows the truncate below to work — without
            it the flex child refuses to shrink and the name overflows. */}
        <span className="min-w-0 truncate">{current?.name ?? "Select workspace"}</span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Workspaces
        </DropdownMenuLabel>

        {workspaces.map((workspace) => {
          const active = workspace.slug === currentSlug;
          return (
            <DropdownMenuItem key={workspace.id} asChild>
              <Link href={`/w/${workspace.slug}`} className="cursor-pointer gap-2">
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {active ? (
                  <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                ) : null}
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          {/*
            `?tab=create` is not decoration. Without it the picker sees a user
            with one workspace, assumes they arrived by accident, and redirects
            them straight back — so this link would appear to do nothing at all.
          */}
          <Link
            href="/workspaces?tab=create"
            className="text-muted-foreground cursor-pointer gap-2"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
