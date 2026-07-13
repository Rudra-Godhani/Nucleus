import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Three faces, three jobs.
 *
 * Instrument Sans carries the interface — it stays legible at 12px, which most
 * of this app lives at. Instrument Serif appears only at display sizes, where a
 * serif reads as considered rather than decorative. JetBrains Mono is reserved
 * for things the user may have to read character-by-character or copy: issue
 * identifiers and invite codes.
 *
 * `display: swap` so text is never invisible while a font loads.
 */
const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nucleus",
    template: "%s · Nucleus",
  },
  description:
    "An open-source issue tracker for teams. Projects, a keyboard-driven board, and live updates.",
};

export const viewport: Viewport = {
  // Matches the canvas in each theme, so the mobile browser chrome blends into
  // the page instead of framing it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#141518" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required and load-bearing: next-themes writes
    // the theme class onto <html> before React hydrates, to avoid a flash of the
    // wrong theme. That write is invisible to the server render.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <body className="min-h-svh antialiased">
        <ThemeProvider>
          {/* First tab stop on every page. Keyboard users should not have to
              walk the entire header to reach the content. */}
          <a
            href="#main"
            className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only rounded-md px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50"
          >
            Skip to content
          </a>

          {children}

          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
