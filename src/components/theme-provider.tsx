"use client";

// 'use client': next-themes reads localStorage and the OS colour-scheme media
// query, neither of which exists on the server.

import { ThemeProvider as NextThemeProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // The theme is applied by swapping a class on <html>, which would
      // otherwise animate every colour token on the page at once — a full-screen
      // colour smear. Disabling transitions for the swap makes it instant.
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
