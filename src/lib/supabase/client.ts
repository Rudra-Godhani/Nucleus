import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database.types";

/**
 * Supabase client for the browser.
 *
 * Nucleus does not fetch data through this client — reads and writes go through
 * Server Components and Server Actions, so they are covered by the data layer
 * and validated server-side. This exists for the one thing that genuinely has to
 * happen in the browser: subscribing to Realtime (Step 7).
 *
 * It carries only the publishable key, so it is bounded by the same RLS policies
 * as everything else. A stolen publishable key grants a caller nothing beyond
 * what an anonymous visitor already has.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
