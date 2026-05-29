"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AuthProvider } from "@/src/app/AuthContext";
import { ThemeProvider } from "@/src/app/ThemeContext";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <NuqsAdapter>
            <ErrorBoundary>
                <ThemeProvider>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </ThemeProvider>
            </ErrorBoundary>
        </NuqsAdapter>
    );
}
