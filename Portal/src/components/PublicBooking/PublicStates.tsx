import type { ApiClientError } from "@/src/api/base/apiClients";
import styles from "./PublicBooking.module.css";

/** The one page every 404 (unknown, disabled or not-live provider) renders, so they look the same. */
export function Unavailable() {
    return (
        <section className={`dash-card ${styles.state}`}>
            <h1 className={styles.stateTitle}>Esta página de reservas no está disponible</h1>
            <p className={styles.muted}>Verifica el enlace o contacta directamente al profesional.</p>
        </section>
    );
}

export function ErrorState({ error, onRetry, inline = false }: { error: ApiClientError; onRetry: () => void; inline?: boolean }) {
    return (
        <div className={inline ? styles.empty : `dash-card ${styles.state}`} role="alert">
            <p className={styles.muted}>{error.message}</p>
            <button type="button" className="btn-secondary" onClick={onRetry}>Reintentar</button>
        </div>
    );
}

export function PublicPageShell({ children }: { children: React.ReactNode }) {
    return (
        <main className={styles.page}>
            <div className={styles.container}>{children}</div>
        </main>
    );
}
