import Link from "next/link";
import { Wordmark } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Auth shell.
 *
 * A split layout: the form on the left, a quiet panel on the right that gives the
 * page somewhere to breathe. The panel is decorative and hidden below `lg` — on a
 * phone it would just be a wall of nothing above the fields.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,46%)]">
      <div className="relative flex flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-md transition-opacity hover:opacity-70"
            aria-label="Nucleus home"
          >
            <Wordmark className="text-base" />
          </Link>
          <ThemeToggle />
        </header>

        <main id="main" className="flex flex-1 items-center justify-center py-12">
          <div className="animate-rise w-full max-w-sm">{children}</div>
        </main>

        <footer className="text-muted-foreground text-xs">
          Open source. Your data stays yours.
        </footer>
      </div>

      {/* Decorative panel. aria-hidden because it says nothing a screen-reader
          user needs to hear, and inert so it cannot be tabbed into. */}
      <aside
        aria-hidden="true"
        className="bg-card relative hidden overflow-hidden border-l lg:block"
      >
        <div className="bg-primary/12 absolute -top-24 -right-24 size-[28rem] rounded-full blur-[120px]" />
        <div className="bg-primary/8 absolute -bottom-32 -left-24 size-[26rem] rounded-full blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <figure className="absolute inset-0 flex flex-col justify-end p-12">
          <blockquote className="font-display max-w-sm text-3xl leading-tight tracking-tight">
            Every workspace is isolated in the database, not just the interface.
          </blockquote>
          <figcaption className="text-muted-foreground mt-4 font-mono text-xs">
            supabase/tests/002_workspace_isolation_rls.sql
          </figcaption>
        </figure>
      </aside>
    </div>
  );
}
