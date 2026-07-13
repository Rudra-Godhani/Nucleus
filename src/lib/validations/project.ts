import { z } from "zod";

/**
 * A project key is the prefix in an issue identifier: PLAT-14.
 *
 * It matches the CHECK constraint on `projects.key` exactly. Keeping the two in
 * step matters: if Zod were laxer than the database, the user would get an opaque
 * 500 instead of a field error telling them what is wrong.
 */
export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "Key must be at least 2 characters")
  .max(6, "Key must be at most 6 characters")
  .regex(/^[A-Z][A-Z0-9]*$/, "Start with a letter, then letters or numbers only");

/**
 * "Platform" -> "PLAT". "Mobile App" -> "MA". "3D Rendering" -> "DR".
 *
 * Lives here, not in the form, so the server can fall back to it — the same
 * lesson the workspace slug taught: a value only ever computed in the browser is a
 * value that vanishes when JavaScript has not loaded yet.
 *
 * Multi-word names become initials, which is what people expect and what keeps
 * "Mobile App" from turning into the unreadable "MOBI". Single words are
 * truncated. Leading digits are dropped because the key must begin with a letter.
 */
export function deriveProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "";

  const raw =
    words.length > 1
      ? words.map((word) => word[0]).join("") // initials
      : words[0];

  // The key must start with a letter, so drop any leading digits.
  const trimmed = raw.replace(/^[0-9]+/, "");

  return trimmed.slice(0, 6);
}

export const createProjectSchema = z
  .object({
    workspaceId: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(80, "Name must be at most 80 characters"),
    // Optional on the way in; always present on the way out.
    key: z.string().trim().optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description must be at most 500 characters")
      .optional(),
  })
  .transform((input) => ({
    ...input,
    key: input.key && input.key.length > 0 ? input.key : deriveProjectKey(input.name),
  }))
  // Validated *after* the fallback, so a derived key is held to exactly the same
  // rules as one the user typed.
  .pipe(
    z.object({
      workspaceId: z.uuid(),
      name: z.string(),
      key: projectKeySchema,
      description: z.string().optional(),
    }),
  );

export const updateProjectSchema = z.object({
  projectId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be at most 80 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

export const deleteProjectSchema = z.object({
  projectId: z.uuid(),
  /** Typed back by the user to confirm. Deleting a project takes its issues too. */
  confirmKey: z.string().trim(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
