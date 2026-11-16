"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { LoginModal } from "@/src/components/Modals/LoginModal";

/**
 * The landing page's only client-side pieces. The page itself is server-rendered so crawlers and
 * first paint get its content without waiting for the session probe; these islands add the login
 * modal and send a signed-in provider to the dashboard once the probe settles.
 */
export function LandingLoginButton({ className, testId, children }: {
    className: string;
    testId: string;
    children: React.ReactNode;
}) {
    const [ open, setOpen ] = useState(false);
    return (
        <>
            <button className={className} onClick={() => setOpen(true)} data-testid={testId}>
                {children}
            </button>
            {/* Portaled: the sticky nav's backdrop-filter would otherwise contain the fixed overlay. */}
            {open && createPortal(<LoginModal onClose={() => setOpen(false)} />, document.body)}
        </>
    );
}

export function LandingSessionRedirect() {
    const { isAuthenticated, initializing } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        if (!initializing && isAuthenticated) router.replace("/dashboard");
    }, [ initializing, isAuthenticated, router ]);

    return null;
}
