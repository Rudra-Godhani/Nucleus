import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signUpAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">Start tracking issues in minutes.</p>
      </div>

      <AuthForm
        action={signUpAction}
        next={next}
        submitLabel="Create account"
        pendingLabel="Creating account…"
        fields={[
          {
            name: "displayName",
            label: "Name",
            type: "text",
            autoComplete: "name",
            placeholder: "Ada Lovelace",
          },
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
            autoComplete: "new-password",
            placeholder: "At least 8 characters",
          },
        ]}
        footer={{
          prompt: "Already have an account?",
          linkText: "Sign in",
          href: "/login",
        }}
      />
    </div>
  );
}
