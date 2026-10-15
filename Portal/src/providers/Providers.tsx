"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "./ThemeContext";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { initBrowserSentry } from "@/src/utils/observability/sentry";

// Module scope, not an effect: React runs child effects and componentDidCatch before this
// component's effects, so errors thrown on the first render would be dropped. No-op on the server.
initBrowserSentry();

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
