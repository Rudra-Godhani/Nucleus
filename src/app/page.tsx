import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GitBranch, Keyboard, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getCurrentUser } from "@/lib/data/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/workspaces");

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      {/* Atmosphere. Two soft ember washes and a faint grid — enough to give the
          page depth without becoming the "purple gradient" everyone has seen a
          thousand times. Inert, so it never eats a click. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/12 absolute -top-40 -left-32 size-[34rem] rounded-full blur-[130px]" />
        <div className="bg-primary/6 absolute top-1/3 -right-40 size-[30rem] rounded-full blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 55% at 50% 30%, black, transparent)",
          }}
        />
      </div>

      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Wordmark className="text-base" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center px-6 py-16 sm:px-10">
        <div className="stagger mx-auto w-full max-w-2xl">
          <p
            style={{ "--i": 0 } as React.CSSProperties}
            className="text-muted-foreground mb-6 inline-flex items-center gap-2 text-xs tracking-wide uppercase"
          >
            <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
            Open source issue tracking
          </p>

          <h1
            style={{ "--i": 1 } as React.CSSProperties}
            className="font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl"
          >
            The issue tracker
            <br />
            that gets out of
            <br />
            <span className="text-primary italic">the way.</span>
          </h1>

          <p
            style={{ "--i": 2 } as React.CSSProperties}
            className="text-muted-foreground mt-7 max-w-md text-base leading-relaxed"
          >
            Projects, a keyboard-driven board, and live updates — with none of the ceremony.
            Your team&rsquo;s data is isolated in the database, not just the interface.
          </p>

          <div
            style={{ "--i": 3 } as React.CSSProperties}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="group gap-2">
              <Link href="/signup">
                Get Started
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>

          <ul
            style={{ "--i": 4 } as React.CSSProperties}
            className="border-border mt-16 grid gap-6 border-t pt-8 sm:grid-cols-3"
          >
            {[
              { icon: GitBranch, title: "Board", body: "Drag to change status. Nothing to save." },
              { icon: Radio, title: "Live", body: "Changes land for everyone, instantly." },
              { icon: Keyboard, title: "Fast", body: "A command palette and real shortcuts." },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="space-y-1.5">
                <Icon className="text-primary size-4" aria-hidden="true" />
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
