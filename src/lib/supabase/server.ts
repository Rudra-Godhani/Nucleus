import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * A new client is created per request — never hoist this into a module-level
 * singleton. The client carries the caller's auth cookies, so a shared instance
 * would leak one user's session into another user's request.
 *
 * Used only by `src/lib/data/*`. ESLint blocks importing it anywhere else.
 */
export async function createClient() {
  // `cookies()` is async in Next 16.
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components are not allowed to write cookies, and Next
            // throws if you try. That is fine to swallow *here specifically*:
            // the proxy (src/proxy.ts) refreshes the session cookie on every
            // request, so the token is kept fresh regardless. Swallowing it
            // anywhere that is allowed to set cookies would be a bug.
          }
        },
      },
    },
  );
}
