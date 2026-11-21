"use client";

import { useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import styles from "./Sheet.module.css";

/** How far the handle must travel down before letting go closes the sheet. */
export const DRAG_CLOSE_DISTANCE = 80;

export interface SheetProps {
    /** Shown as the sheet's heading; with `hideTitle` it only names the dialog for screen readers. */
    title: string;
    hideTitle?: boolean;
    onClose: () => void;
    children: ReactNode;
    /** Actions pinned below the scrolling content, side by side. */
    footer?: ReactNode;
    testId?: string;
}

/**
 * A bottom sheet on phones and a centered dialog from 960px. It traps focus through the nearest
 * FocusTrapProvider, which the provider app already supplies; public pages use `PublicSheet`.
 */
export function Sheet({ title, hideTitle = false, onClose, children, footer, testId }: SheetProps) {
    const { ref, handleKeyDown } = useFocusTrap<HTMLDivElement>(onClose);
    const titleId = useId();
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
    const onPointerCancel = () => {
        dragStart.current = null;
        setDragged(0);
    };

    const close = (
        <button type="button" className={hideTitle ? styles.close : styles.headerClose} aria-label="Cerrar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
        </button>
    );

    return (
        <div className={styles.scrim} data-testid="sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                ref={ref}
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-label={hideTitle ? title : undefined}
                aria-labelledby={hideTitle ? undefined : titleId}
                style={dragged ? { transform: `translateY(${dragged}px)` } : undefined}
                onKeyDown={handleKeyDown}
                data-testid={testId}
            >
                <div className={styles.handle} data-testid="sheet-handle" aria-hidden="true"
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />
                {hideTitle ? close : (
                    <div className={styles.header}>
                        <h2 id={titleId} className={styles.title}>{title}</h2>
                        {close}
                    </div>
                )}
                <div className={styles.body}>{children}</div>
                {footer && <div className={styles.footer}>{footer}</div>}
            </div>
        </div>
    );
}
