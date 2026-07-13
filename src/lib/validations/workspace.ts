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

/**
 * "Acme Corp!" -> "acme-corp".
 *
 * Lives here rather than in the form so the server can fall back to it. The
 * create-workspace form fills the URL field in as you type, but that only happens
 * once JavaScript has loaded — so a fast typist (or anyone on a slow connection)
 * can submit with the field still empty, and be told "URL must be at least 3
 * characters" about a field they never touched. Deriving it server-side when it is
 * missing makes the form work with no JavaScript at all, and turns the live
 * preview into what it should have been all along: a convenience, not a dependency.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const createWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(80, "Name must be at most 80 characters"),
    // Optional on the way in; always present on the way out.
    slug: z.string().trim().optional(),
  })
  .transform((input) => ({
    name: input.name,
    slug: input.slug && input.slug.length > 0 ? input.slug : slugify(input.name),
  }))
  // Validated *after* the fallback, so the derived slug is held to exactly the
  // same rules as one the user typed — and to the same rules as the database
  // CHECK constraint.
  .pipe(
    z.object({
      name: z.string(),
      slug: workspaceSlugSchema,
    }),
  );

export const memberRoleSchema = z.enum(["owner", "admin", "member"]);

/**
 * An invite is either shareable (no email) or addressed to one person.
 * `owner` is excluded on purpose: there is exactly one owner, created with the
 * workspace. Handing out owner invites would be a way to bypass that.
 */
export const createInviteSchema = z.object({
  workspaceId: z.uuid(),
  // Absent (a shareable link) or a real address (an invite for one person).
  // The action is responsible for turning a missing form field into `undefined`
  // before it gets here — `formData.get()` yields `null` for a field that is not
  // in the DOM at all, and `null` is not the same thing as "not provided".
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address"))
    .optional(),
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
