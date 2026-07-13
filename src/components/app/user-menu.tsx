"use client";

// 'use client': a dropdown, and it hosts the theme control.

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar } from "@/components/shared/avatar";
import { signOutAction } from "@/app/(auth)/actions";

/**
 * Account menu.
 *
 * Sign-out used to be a permanently visible button in the header — a destructive
 * action given equal billing with navigation. It lives here now, one level down,
 * where it cannot be hit by accident.
 */
export function UserMenu({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring/70 rounded-full outline-none focus-visible:ring-2"
        aria-label={`Account menu for ${displayName}`}
      >
        <Avatar name={displayName} className="size-7" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar name={displayName} className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-muted-foreground text-xs">Theme</span>
          <ThemeToggle />
        </div>

        <DropdownMenuSeparator />

        {/*
          A form, not an onClick — sign-out is a mutation, and this keeps it
          working if JavaScript has not loaded yet.
        */}
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="text-destructive focus:text-destructive w-full cursor-pointer gap-2"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
