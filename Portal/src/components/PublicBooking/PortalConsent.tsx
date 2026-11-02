"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useAcceptConsent } from "@/src/api/portal/usePortalAuth";
import styles from "./Portal.module.css";

interface PortalConsentProps {
    onAccepted: () => void;
    onSessionLost: () => void;
}

export function PortalConsent({ onAccepted, onSessionLost }: PortalConsentProps) {
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
                <p className={styles.lead}>
                    Para mostrarte tus citas y permitirte reservar, necesitamos tu autorización para tratar tus datos
                    personales con este fin.
                </p>
                <label className={styles.checkbox}>
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span>
                        Acepto el tratamiento de mis datos personales según la{" "}
                        <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.
                    </span>
                </label>
                {error && <p className={`error-inline ${styles.error}`} role="alert">{error}</p>}
                <button type="submit" className={`btn-primary ${styles.submit}`} disabled={!checked || loading}>
                    {loading ? "Guardando…" : "Continuar"}
                </button>
            </form>
        </section>
    );
}
