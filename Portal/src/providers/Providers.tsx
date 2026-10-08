"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "./ThemeContext";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ErrorBoundary>
        <ThemeProvider>
          <FocusTrapProvider>{children}</FocusTrapProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </NuqsAdapter>
  );
}
