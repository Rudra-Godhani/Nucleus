import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyPendingInvites, listMyWorkspaces } from "@/lib/data/workspaces";
import { acceptInviteAction } from "@/app/(app)/actions";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { JoinByCodeForm } from "@/components/workspace/join-by-code-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Workspaces" };

/**
 * Workspace picker.
 *
 * Both queries are independent, so they run concurrently — awaiting them in
 * sequence would make the page wait for one round trip before starting the next.
 */
export default async function WorkspacesPage() {
  const [workspaces, pendingInvites] = await Promise.all([
    listMyWorkspaces(),
    getMyPendingInvites(),
  ]);

  // Nothing to choose between: go straight to the only workspace. Making someone
  // click through a list of one is busywork.
  if (workspaces.length === 1 && pendingInvites.length === 0) {
    redirect(`/w/${workspaces[0].slug}`);
  }

  const hasWorkspaces = workspaces.length > 0;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <div className="mb-8 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {hasWorkspaces ? "Your workspaces" : "Create your first workspace"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {hasWorkspaces
            ? "Pick one to jump back in."
            : "A workspace holds your projects, issues and team."}
        </p>
      </div>

      {pendingInvites.length > 0 ? (
        <section className="mb-8 space-y-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Invitations
          </h2>
          {pendingInvites.map((invite) => (
            <Card key={invite.code}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{invite.workspaceName}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  You have been invited as {invite.role}.
                </p>
              </CardHeader>
              <CardContent>
                {/*
                  The code travels in a hidden field, but nothing trusts it:
                  redeem_invite() re-checks that this invite is addressed to the
                  caller's own email before letting them in.
                */}
                <form action={acceptInviteAction}>
                  <input type="hidden" name="code" value={invite.code} />
                  <Button type="submit" size="sm">
                    Accept invitation
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {hasWorkspaces ? (
        <section className="mb-8 space-y-2">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              href={`/w/${workspace.slug}`}
              className="border-border/60 hover:bg-accent flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
            >
              <span className="font-medium">{workspace.name}</span>
              <span className="text-muted-foreground text-xs">/{workspace.slug}</span>
            </Link>
          ))}
        </section>
      ) : null}

      <Separator className="my-8" />

      <section className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            New workspace
          </h2>
          <CreateWorkspaceForm />
        </div>

        <div className="space-y-4">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Have an invite code?
          </h2>
          <JoinByCodeForm />
        </div>
      </section>
    </div>
  );
}
