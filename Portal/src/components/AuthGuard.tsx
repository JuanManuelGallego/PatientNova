"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/src/app/AuthContext";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, initializing } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        if (!initializing && !isAuthenticated) {
            router.replace("/login");
        }
    }, [ initializing, isAuthenticated, router ]);

    if (initializing) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                background: "var(--c-bg)",
                flexDirection: "column",
                gap: 16,
            }}>
                <LoadingSpinner />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
