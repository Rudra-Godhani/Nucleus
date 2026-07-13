"use client";

// 'use client': the active nav item is derived from the current pathname, and the
// switcher/menu are dropdowns.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { UserMenu } from "@/components/app/user-menu";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/app/workspace-switcher";
import { cn } from "@/lib/utils";

/**
 * The single bar of app chrome.
 *
 * This replaces two stacked bars — a global one and a per-workspace one — which
 * cost 6rem of vertical space and made "where am I" ambiguous. Everything now
 * lives on one line: identity, location, navigation, account.
 *
 * The workspace slug is read from the pathname rather than passed down, so the
 * header does not have to be re-rendered by every layout beneath it.
 */
export function AppHeader({
  workspaces,
  displayName,
  email,
}: {
  workspaces: WorkspaceOption[];
  displayName: string;
  email: string;
}) {
  const pathname = usePathname();

  // "/w/acme/members" -> "acme"
  const pathSlug = pathname.startsWith("/w/") ? pathname.split("/")[2] : undefined;

  // Only treat it as the current workspace if it is genuinely one of the user's.
  // A URL for a workspace that does not exist — or that belongs to someone else —
  // resolves to a 404 underneath, and showing Overview/Members tabs above that
  // would advertise navigation into a workspace they cannot reach.
  const slug = workspaces.some((w) => w.slug === pathSlug) ? pathSlug : undefined;

  const tabs = slug
    ? [
        { href: `/w/${slug}`, label: "Overview", exact: true },
        { href: `/w/${slug}/members`, label: "Members", exact: false },
      ]
    : [];

  return (
    <header className="bg-background/80 sticky top-0 z-30 backdrop-blur-md">
      <div className="flex h-14 items-center gap-1 px-4 sm:px-6">
        <Link
          href="/workspaces"
          aria-label="Nucleus home"
          className="focus-visible:ring-ring/70 mr-1 rounded-md p-1 transition-opacity hover:opacity-70 focus-visible:ring-2"
        >
          <Logo />
        </Link>

        {workspaces.length > 0 ? (
          <>
            <span className="text-border-strong select-none" aria-hidden="true">
              /
            </span>
            <WorkspaceSwitcher workspaces={workspaces} currentSlug={slug} />
          </>
        ) : null}

        {/*
          The nav is full-height on purpose. The active indicator sits on the
          header's bottom edge, and `overflow-x-auto` (needed so tabs scroll
          rather than wrap on a narrow screen) establishes a clipping box — so
          anything drawn outside the nav's own height is cut off, and the
          resulting vertical overflow paints a stray scrollbar. Giving the nav the
          full header height puts the indicator inside the box, which fixes both.
        */}
        <nav
          aria-label="Workspace"
          className="ml-2 flex h-full min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center rounded-md px-2.5 text-sm transition-colors duration-150",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {tab.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="bg-primary absolute inset-x-2.5 bottom-0 h-0.5 rounded-full"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <UserMenu displayName={displayName} email={email} />
        </div>
      </div>

      {/* A hairline that fades at both ends, so the header does not read as a box
          drawn around the page. */}
      <div className="rule-fade h-px" aria-hidden="true" />
    </header>
  );
}
