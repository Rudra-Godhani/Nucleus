import { z } from "zod";

/**
 * Workspace and invite input boundaries.
 */

/**
 * A slug appears in URLs, so it is constrained to match the CHECK constraint on
 * `workspaces.slug`. Keeping the two in step matters: if Zod were laxer than the
 * database, a user would get an opaque 500 instead of a field error.
 */
export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "URL must be at least 3 characters")
  .max(50, "URL must be at most 50 characters")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Use lowercase letters, numbers and dashes (not at the start or end)",
  );

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be at most 80 characters"),
  slug: workspaceSlugSchema,
});

export const memberRoleSchema = z.enum(["owner", "admin", "member"]);

/**
 * An invite is either shareable (no email) or addressed to one person.
 * `owner` is excluded on purpose: there is exactly one owner, created with the
 * workspace. Handing out owner invites would be a way to bypass that.
 */
export const createInviteSchema = z.object({
  workspaceId: z.uuid(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address"))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  role: z.enum(["admin", "member"]).default("member"),
});

export const redeemInviteSchema = z.object({
  code: z.string().trim().min(1, "Enter an invite code"),
});

export const removeMemberSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.uuid(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
