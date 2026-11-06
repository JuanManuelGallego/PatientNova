"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { FocusTrapProvider, useFocusTrap } from "@/src/hooks/useFocusTrap";
import styles from "./PublicSheet.module.css";

const DRAG_CLOSE_DISTANCE = 80;

interface PublicSheetProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
}

/** A bottom sheet on phones and a centered dialog on desktop. Public pages bring their own focus-trap registry. */
export function PublicSheet(props: PublicSheetProps) {
    return (
        <FocusTrapProvider>
            <SheetPanel {...props} />
        </FocusTrapProvider>
    );
}

function SheetPanel({ title, onClose, children }: PublicSheetProps) {
    const { ref, handleKeyDown } = useFocusTrap<HTMLDivElement>(onClose);
    const dragStart = useRef<number | null>(null);
    const [ dragged, setDragged ] = useState(0);

    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        dragStart.current = e.clientY;
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
        if (dragStart.current !== null) setDragged(Math.max(0, e.clientY - dragStart.current));
    };
    const onPointerUp = () => {
        dragStart.current = null;
        if (dragged > DRAG_CLOSE_DISTANCE) onClose();
        else setDragged(0);
    };

    return (
        <div className={styles.scrim} data-testid="sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                ref={ref}
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={dragged ? { transform: `translateY(${dragged}px)` } : undefined}
                onKeyDown={handleKeyDown}
            >
                <div className={styles.handle} data-testid="sheet-handle" aria-hidden="true"
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
                <button type="button" className={styles.close} aria-label="Cerrar" onClick={onClose}>
                    <X size={18} aria-hidden="true" />
                </button>
                <div className={styles.body}>{children}</div>
            </div>
        </div>
    );
}
