"use client";

import type { ReactNode } from "react";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { Sheet } from "@/src/components/Sheet/Sheet";

interface PublicSheetProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
}

/** The shared sheet with its title kept for screen readers. Public pages bring their own focus-trap registry. */
export function PublicSheet({ title, onClose, children }: PublicSheetProps) {
    return (
        <FocusTrapProvider>
            <Sheet title={title} hideTitle onClose={onClose}>{children}</Sheet>
        </FocusTrapProvider>
    );
}
