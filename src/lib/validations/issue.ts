import { z } from "zod";

/**
 * Issue input boundaries. These mirror the database enums and CHECK constraints
 * exactly — if Zod were laxer, the user would get an opaque 500 instead of a field
 * error telling them what is wrong.
 */

export const issueStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
]);

export const issuePrioritySchema = z.enum(["none", "low", "medium", "high", "urgent"]);

const title = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(200, "Title must be at most 200 characters");

/**
 * An empty string means "unassigned", not "invalid".
 *
 * A <select> with no choice made submits "", and a plain `z.uuid().optional()`
 * would reject that — failing validation on a field the user deliberately left
 * blank. This turns it into an explicit null instead.
 */
const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((value) => (value ? value : null));

export const createIssueSchema = z.object({
  workspaceId: z.uuid(),
  projectId: z.uuid(),
  title,
  description: z
    .string()
    .trim()
    .max(10_000, "Description must be at most 10,000 characters")
    .optional(),
  status: issueStatusSchema.default("backlog"),
  priority: issuePrioritySchema.default("none"),
  assigneeId: optionalUuid,
  labelIds: z.array(z.uuid()).default([]),
});

export const updateIssueSchema = z.object({
  issueId: z.uuid(),
  title,
  description: z
    .string()
    .trim()
    .max(10_000, "Description must be at most 10,000 characters")
    .optional(),
  status: issueStatusSchema,
  priority: issuePrioritySchema,
  assigneeId: optionalUuid,
  labelIds: z.array(z.uuid()).default([]),
});

/** Used by the board (Step 7) and the inline status control on a list row. */
export const setIssueStatusSchema = z.object({
  issueId: z.uuid(),
  status: issueStatusSchema,
});

export const deleteIssueSchema = z.object({
  issueId: z.uuid(),
});

/**
 * Filters. Kept in the URL, so a filtered view can be linked to and refreshed.
 *
 * Parsed as strictly as any other input, because these values reach the database:
 * an `assigneeId` of "🙂" would go straight into a `.eq()` and come back as a
 * Postgres cast error rather than an empty list. A URL is user input like any other.
 */
export const issueFiltersSchema = z.object({
  status: z.array(issueStatusSchema).default([]),
  priority: z.array(issuePrioritySchema).default([]),
  /** A user id, or the literal "unassigned" — which is a question, not a person. */
  assigneeId: z.union([z.uuid(), z.literal("unassigned")]).optional(),
  labelId: z.uuid().optional(),
});

/**
 * The colours a label may be.
 *
 * A closed set rather than a free colour input, and the schema enforces it. Two
 * reasons, and the second is the one that matters: a picker of nine swatches gives a
 * workspace a coherent palette instead of nine shades of nearly-red, and a value
 * that goes straight into a `style` attribute must never be arbitrary user text.
 */
export const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
] as const;

export const createLabelSchema = z.object({
  workspaceId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(40, "Name must be at most 40 characters"),
  color: z.enum(LABEL_COLORS).default("#6b7280"),
});

export const deleteLabelSchema = z.object({
  labelId: z.uuid(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type IssueFilters = z.infer<typeof issueFiltersSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
