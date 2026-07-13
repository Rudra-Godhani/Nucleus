import { z } from "zod";

/**
 * Public environment variables — these are inlined into the browser bundle by
 * Next.js, so ONLY ever put non-secret values here.
 *
 * We deliberately use the *publishable* key rather than the legacy `anon` key:
 * Supabase now treats publishable keys as the supported client-side key, and
 * legacy anon keys exist only for backwards compatibility.
 *
 * The service-role/secret key is intentionally absent from this file and from
 * the app entirely. Nothing in Nucleus runs with RLS bypassed — if a query
 * needs elevated access, that is a signal the RLS policy is wrong, not a
 * signal to reach for the service key.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g. https://xxxx.supabase.co)",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
});

/**
 * Next.js only inlines `process.env.X` when X is written out literally, so we
 * cannot iterate over the schema keys here — each one must be spelled out.
 */
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid environment configuration:\n${issues}\n\n` +
      `Copy .env.example to .env.local and fill in your Supabase project values.`,
  );
}

export const env = parsed.data;
