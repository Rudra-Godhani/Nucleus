import Link from "next/link";

/** Shared chrome for the signed-out routes: a centred card on an empty page. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-lg font-semibold tracking-tight"
        >
          Nucleus
        </Link>
        {children}
      </div>
    </div>
  );
}
