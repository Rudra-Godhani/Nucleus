import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signInAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // `next` is where the proxy bounced the user from, so signing in returns them
  // there. It is attacker-controllable, so the action re-validates it server-side
  // rather than trusting it here.
  const { next } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to pick up where you left off.</p>
      </div>

      <AuthForm
        action={signInAction}
        next={next}
        submitLabel="Sign In"
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
            placeholder: "••••••••",
          },
        ]}
        footer={{ prompt: "New here?", linkText: "Create an account", href: "/signup" }}
      />
    </div>
  );
}
