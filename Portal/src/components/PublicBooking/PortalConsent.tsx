"use client";

import { useId, useState, type FormEvent } from "react";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useAcceptConsent } from "@/src/api/portal/usePortalAuth";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { ConsentLabel, ConsentNotice } from "./ConsentNotice";
import styles from "./Portal.module.css";

interface PortalConsentProps {
    provider: PublicProvider;
    onAccepted: () => void;
    onSessionLost: () => void;
}

export function PortalConsent({ provider, onAccepted, onSessionLost }: PortalConsentProps) {
    const ids = useId();
    const [ checked, setChecked ] = useState(false);
    const { acceptConsent, loading, error } = useAcceptConsent();

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!checked || loading) return;
        try {
            await acceptConsent();
            onAccepted();
        } catch (err) {
            if (err instanceof ApiClientError && err.status === 401) onSessionLost();
        }
    };

    return (
        <section className={`dash-card ${styles.card}`} aria-labelledby={`${ids}-title`}>
            <h1 id={`${ids}-title`} className={styles.title}>Antes de continuar</h1>
            <form className={styles.form} onSubmit={onSubmit}>
                <ConsentNotice provider={provider} />
                <label className={styles.checkbox}>
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <ConsentLabel provider={provider} />
                </label>
                {error && <p className={`error-inline ${styles.error}`} role="alert">{error}</p>}
                <button type="submit" className={`btn-primary ${styles.submit}`} disabled={!checked || loading}>
                    {loading ? "Guardando…" : "Continuar"}
                </button>
            </form>
        </section>
    );
}
