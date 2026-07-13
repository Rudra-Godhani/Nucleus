import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/data/auth";
import {
  getMyRole,
  getWorkspaceBySlug,
  listInvites,
  listMembers,
} from "@/lib/data/workspaces";
import { removeMemberAction, revokeInviteAction } from "@/app/(app)/actions";
import { InviteForm } from "@/components/workspace/invite-form";
import { CopyButton } from "@/components/workspace/copy-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Independent reads, so fetch them together rather than in a waterfall.
  const [user, role, members, invites] = await Promise.all([
    getCurrentUser(),
    getMyRole(workspace.id),
    listMembers(workspace.id),
    // RLS returns an empty list to a plain member rather than an error, so this
    // is safe to call unconditionally — no need to branch on role first.
    listInvites(workspace.id),
  ]);

  const canManage = role === "owner" || role === "admin";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Members</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {canManage
          ? "Invite people and manage who has access."
          : "People with access to this workspace."}
      </p>

      <section className="mt-8 space-y-1">
        {members.map((member) => {
          const isSelf = member.userId === user?.id;
          // An owner cannot be removed — the workspace would be left without one.
          // Everyone can remove themselves (leaving), which RLS also permits.
          const canRemove =
            member.role !== "owner" && (canManage || isSelf) && !(isSelf && role === "owner");

          return (
            <div
              key={member.userId}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
            >
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">
                  {member.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.displayName}
                  {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">{member.email}</p>
              </div>

              <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                {member.role}
              </Badge>

              {canRemove ? (
                <form action={removeMemberAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" variant="ghost" size="sm">
                    {isSelf ? "Leave" : "Remove"}
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
      </section>

      {/*
        The UI hides invite management from non-admins, but that is only tidiness.
        The actual rule is the RLS policy on workspace_invites — a member who
        posted straight to the action would still be refused by the database.
      */}
      {canManage ? (
        <>
          <Separator className="my-10" />

          <section className="space-y-4">
            <h2 className="text-sm font-medium">Invite someone</h2>
            <InviteForm workspaceId={workspace.id} slug={slug} />
          </section>

          {invites.length > 0 ? (
            <section className="mt-10 space-y-3">
              <h2 className="text-sm font-medium">Open invites</h2>
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="border-border/60 flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {invite.email ?? "Shareable code"}
                      <span className="text-muted-foreground"> · {invite.role}</span>
                    </p>
                    <code className="text-muted-foreground block truncate font-mono text-xs">
                      {invite.code}
                    </code>
                  </div>

                  <CopyButton value={invite.code} label="Copy code" />

                  <form action={revokeInviteAction}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" variant="ghost" size="sm">
                      Revoke
                    </Button>
                  </form>
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
