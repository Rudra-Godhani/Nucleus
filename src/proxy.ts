import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Next 16 renamed Middleware to Proxy. Same mechanism, new file convention.
 *
 * This file does exactly one thing: refresh the Supabase auth token and write
 * the rotated cookies onto the response. Without it, tokens expire and users get
 * logged out mid-session.
 *
 * It is NOT a security boundary, and nothing here should be treated as one.
 * Next's own documentation is explicit that the proxy "should not be used as a
 * full session management or authorization solution" — it runs before the
 * request is resolved and can be bypassed by anything that talks to the database
 * directly. The redirect below is an *optimistic* check: it saves a signed-out
 * user from loading an app shell they cannot use. The real enforcement is RLS in
 * the database, plus the auth checks in `src/lib/data/*`. If you ever find
 * yourself adding an authorization rule here, it belongs in an RLS policy.
 *
 * This constructs a Supabase client directly rather than reusing
 * `lib/supabase/server.ts`, because that one reads cookies via `next/headers`
 * and here we must read from the request and write to the response.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getClaims()` — not `getSession()`. getSession() reads the cookie without
  // verifying it, so it is not guaranteed to revalidate an expired token.
  // Calling this is what triggers the refresh-and-rotate above.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = data?.claims != null;

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublicRoute = pathname === "/" || isAuthRoute || pathname.startsWith("/auth");

  if (!isSignedIn && !isPublicRoute) {
    const redirectTo = new URL("/login", request.url);
    // Preserve where they were headed so login can send them back.
    redirectTo.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectTo);
  }

  if (isSignedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Returning `response` (not a fresh NextResponse) is essential — it carries
  // the refreshed auth cookies. Dropping it silently logs users out.
  return response;
}

export const config = {
  // Skip static assets and image optimization; they never need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
