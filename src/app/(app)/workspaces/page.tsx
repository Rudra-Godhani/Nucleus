import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import { getMyPendingInvites, listMyWorkspaces } from "@/lib/data/workspaces";
import { acceptInviteAction } from "@/app/(app)/actions";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { JoinByCodeForm } from "@/components/workspace/join-by-code-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/shared/page";
import { Avatar } from "@/components/shared/avatar";

export const metadata: Metadata = { title: "Workspaces" };

/**
 * Workspace picker, and the first screen a new account sees.
 *
 * The two ways in — create one, or join one — used to sit stacked on the page as
 * separate always-visible forms, which meant the screen asked two questions at
 * once and answered neither. They are tabs now: one decision, then one form.
 */
export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, workspaces, pendingInvites] = await Promise.all([
    searchParams,
    listMyWorkspaces(),
    getMyPendingInvites(),
  ]);

  // Arriving with no particular intent and only one workspace? Go straight in —
  // making someone pick from a list of one is busywork.
  //
  // But `?tab=` means they *asked* to be here (via "New workspace" in the
  // switcher, say), and redirecting them away from a page they deliberately
  // navigated to makes the link look broken. The intent lives in the URL, so it
  // also survives a refresh and can be linked to.
  const arrivedDeliberately = tab === "create" || tab === "join";

  if (workspaces.length === 1 && pendingInvites.length === 0 && !arrivedDeliberately) {
    redirect(`/w/${workspaces[0].slug}`);
  }

  const isNewHere = workspaces.length === 0;
  const defaultTab = tab === "join" ? "join" : "create";

  return (
    <PageShell size="narrow" className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties} className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">
          {isNewHere ? "Create your workspace" : "Your workspaces"}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isNewHere
            ? "A workspace holds your projects, issues and team. You can create more later."
            : "Pick one to jump back in."}
        </p>
      </div>

      {pendingInvites.length > 0 ? (
        <section
          style={{ "--i": 1 } as React.CSSProperties}
          className="mt-8 space-y-2"
          aria-labelledby="invites-heading"
        >
          <h2
            id="invites-heading"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Invitations
          </h2>

          {pendingInvites.map((invite) => (
            <div
              key={invite.code}
              className="border-primary/25 bg-primary/4 flex items-center gap-3 rounded-xl border p-3"
            >
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Mail className="size-4" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invite.workspaceName}</p>
                <p className="text-muted-foreground text-xs">Invited as {invite.role}</p>
              </div>

              {/* The code rides in a hidden field, but nothing trusts it:
                  redeem_invite() re-checks that the invite is addressed to this
                  caller's own email before letting them in. */}
              <form action={acceptInviteAction}>
                <input type="hidden" name="code" value={invite.code} />
                <Button type="submit" size="sm" className="shrink-0">
                  Accept
                </Button>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      {workspaces.length > 0 ? (
        <section
          style={{ "--i": 2 } as React.CSSProperties}
          className="mt-8 space-y-1.5"
          aria-labelledby="workspaces-heading"
        >
          <h2
            id="workspaces-heading"
            className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase"
          >
            Workspaces
          </h2>

          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              href={`/w/${workspace.slug}`}
              className="group border-border bg-card hover:border-border-strong flex items-center gap-3 rounded-xl border p-3 transition-colors duration-150"
            >
              <Avatar name={workspace.name} className="size-9 rounded-lg text-xs" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{workspace.name}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">
                  /w/{workspace.slug}
                </p>
              </div>

              <ArrowRight
                className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ))}
        </section>
      ) : null}

      <section style={{ "--i": 3 } as React.CSSProperties} className="mt-10">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">
              Create New
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1">
              Join With Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="pt-5">
            <CreateWorkspaceForm />
          </TabsContent>

          <TabsContent value="join" className="pt-5">
            <JoinByCodeForm />
          </TabsContent>
        </Tabs>
      </section>
    </PageShell>
  );
}
