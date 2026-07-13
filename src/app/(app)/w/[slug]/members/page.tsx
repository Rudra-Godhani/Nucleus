import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link2, Mail, Ticket } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell, Section } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/shared/avatar";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { RelativeTime } from "@/components/shared/relative-time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Independent reads — fetch together rather than in a waterfall.
  const [user, role, members, invites] = await Promise.all([
    getCurrentUser(),
    getMyRole(workspace.id),
    listMembers(workspace.id),
    // RLS hands a plain member an empty list rather than an error, so this is
    // safe to call unconditionally — no need to branch on role first.
    listInvites(workspace.id),
  ]);

  const canManage = role === "owner" || role === "admin";

  return (
    <PageShell className="stagger">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <PageHeader
          title="Members"
          description={
            canManage
              ? "Invite people and manage who has access to this workspace."
              : "People with access to this workspace."
          }
        />
      </div>

      <div style={{ "--i": 1 } as React.CSSProperties} className="mt-10">
        <Section title="Team">
          <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
            {members.map((member) => {
              const isSelf = member.userId === user?.id;
              // The owner cannot be removed and cannot leave — either would
              // strand the workspace without one. Everyone else may leave, and
              // admins may remove anyone but the owner.
              const canRemove = member.role !== "owner" && (canManage || isSelf);

              return (
                <li key={member.userId} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={member.displayName} className="size-8" />

                  {/* min-w-0 is what lets the truncation below actually happen. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.displayName}
                      {isSelf ? (
                        <span className="text-muted-foreground font-normal"> · you</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                  </div>

                  {/*
                    Deliberately not the accent, even for `owner`. Ember means
                    "this is the primary action" everywhere else in the app; a
                    role badge is a label, not something to click, and giving it
                    the loudest colour on the page would make it compete with the
                    buttons that actually do something. Owner is distinguished by
                    weight and a solid border instead.
                  */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 capitalize",
                      member.role === "owner"
                        ? "border-border-strong text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {member.role}
                  </Badge>

                  {canRemove ? (
                    <ConfirmButton
                      action={removeMemberAction}
                      hidden={{
                        workspaceId: workspace.id,
                        userId: member.userId,
                        slug,
                      }}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          {isSelf ? "Leave" : "Remove"}
                        </Button>
                      }
                      title={isSelf ? "Leave this workspace?" : `Remove ${member.displayName}?`}
                      description={
                        isSelf
                          ? `You will lose access to ${workspace.name} immediately. You will need a new invite to rejoin.`
                          : `${member.displayName} will lose access to ${workspace.name} immediately. You can invite them again later.`
                      }
                      confirmLabel={isSelf ? "Leave Workspace" : "Remove Member"}
                      pendingLabel={isSelf ? "Leaving…" : "Removing…"}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      {/*
        The UI hides invite management from non-admins, but that is tidiness, not
        security: the rule that actually holds is the RLS policy on
        workspace_invites. A member who posted straight to the action would still
        be refused by the database. Verified in supabase/tests/003.
      */}
      {canManage ? (
        <>
          <div style={{ "--i": 2 } as React.CSSProperties} className="mt-12">
            <Section
              title="Invite Someone"
              description="Share a link, or send an invite to one person."
            >
              <InviteForm workspaceId={workspace.id} slug={slug} />
            </Section>
          </div>

          <div style={{ "--i": 3 } as React.CSSProperties} className="mt-12">
            <Section title="Open Invites">
              {invites.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="No open invites"
                  description="Invites you create will appear here until they are used or expire."
                />
              ) : (
                <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
                  {invites.map((invite) => (
                    // Stacks on a phone. Side by side, the code and the actions
                    // fight over the same 200px and the code loses.
                    <li
                      key={invite.id}
                      className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                          {invite.email ? (
                            <Mail className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Link2 className="size-3.5" aria-hidden="true" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            {invite.email ?? "Anyone with the code"}
                            <span className="text-muted-foreground"> · {invite.role}</span>
                          </p>

                          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                            {/*
                              `truncate`, never `break-all`. break-all on a long
                              unbroken token inside a squeezed flex child wraps it
                              one character per line — a 21-character code became a
                              21-line column on a phone. The full value is one tap
                              away on the Copy button, so truncating loses nothing.

                              translate="no" because an invite code is an opaque
                              token, and a browser auto-translating it would
                              silently corrupt it.
                            */}
                            <code
                              translate="no"
                              title={invite.code}
                              className="min-w-0 truncate font-mono select-all"
                            >
                              {invite.code}
                            </code>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0">
                              expires <RelativeTime iso={invite.expiresAt} />
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                        <CopyButton value={invite.code} label="Copy" />

                        <ConfirmButton
                          action={revokeInviteAction}
                          hidden={{ inviteId: invite.id, slug }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              Revoke
                            </Button>
                          }
                          title="Revoke this invite?"
                          description="The code will stop working immediately. Anyone who has not used it yet will need a new one."
                          confirmLabel="Revoke Invite"
                          pendingLabel="Revoking…"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
