import { z } from "zod";

/**
 * Auth input boundaries.
 *
 * These run on the server, inside the Server Action, because that is the only
 * place validation actually protects anything — a browser can post whatever it
 * likes straight to the action endpoint.
 */

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .pipe(z.email("Enter a valid email address"))
  .transform((value) => value.toLowerCase());

/**
 * Supabase enforces a 6-character minimum by default. We ask for 8, and cap at
 * 72: bcrypt silently truncates beyond 72 bytes, so a longer password would give
 * users a false sense of strength.
 */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const signUpSchema = z.object({
  email,
  password,
  displayName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be at most 80 characters"),
});

export const signInSchema = z.object({
  email,
  // Deliberately not `password` — an existing account may have been created
  // under different rules, and re-validating length here would lock the user out
  // of their own account with a confusing "password too short" on the login form.
  password: z.string().min(1, "Password is required"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
