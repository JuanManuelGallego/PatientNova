"use client";

import { useEffect } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "./ThemeContext";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { initBrowserSentry } from "@/src/utils/observability/sentry";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initBrowserSentry();
  }, []);

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
