import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signInAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Sign in" };

/**
 * `searchParams` is a Promise in Next 16 and must be awaited.
 *
 * `next` carries the page the proxy bounced the user away from, so signing in
 * returns them where they were headed. It is attacker-controllable, so the
 * action re-validates it server-side rather than trusting it here.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your workspace.</p>
      </div>

      <AuthForm
        action={signInAction}
        next={next}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
            placeholder: "you@company.com",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        footer={{
          prompt: "Don't have an account?",
          linkText: "Sign up",
          href: "/signup",
        }}
      />
    </div>
  );
}
