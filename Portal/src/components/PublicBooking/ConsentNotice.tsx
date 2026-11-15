"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { consentLabel, consentNotice, controllerLine, SENSITIVE_DATA_LINE } from "@/src/config/consentText";
import type { PublicProvider } from "@/src/types/PublicBooking";
import styles from "./Portal.module.css";

export function consentDescribedBy(idPrefix: string): string {
    return `${idPrefix}-sensitive ${idPrefix}-notice ${idPrefix}-details`;
}

export function ConsentDisclosure({ provider, idPrefix, className }: { provider: PublicProvider; idPrefix: string; className?: string }) {
    const [ open, setOpen ] = useState(false);
    const moreId = `${idPrefix}-more`;
    return (
        <div className={className}>
            <p className={styles.fine}>
                <span id={`${idPrefix}-sensitive`} data-testid="consent-sensitive">{SENSITIVE_DATA_LINE}</span>{" "}
                <button type="button" className={styles.inlineToggle} aria-expanded={open} aria-controls={moreId} onClick={() => setOpen((o) => !o)}>
                    Ver detalles
                    <ChevronDown size={14} aria-hidden="true" />
                </button>
            </p>
            <div id={moreId} className={styles.consentMore} hidden={!open}>
                <p id={`${idPrefix}-notice`} className={styles.fine} data-testid="consent-notice">{consentNotice(provider)}</p>
                <p id={`${idPrefix}-details`} className={styles.fine} data-testid="consent-controller">{controllerLine(provider)}</p>
            </div>
        </div>
    );
}

export function ConsentLabel({ provider }: { provider: PublicProvider }) {
    return (
        <span>
            {consentLabel(provider)}{" "}
            <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.
        </span>
    );
}
