import { CircleAlert, SearchX } from "lucide-react";
import type { ApiClientError } from "@/src/api/base/apiClients";
import styles from "./PublicBooking.module.css";
import { StateIcon } from "./PublicChrome";

export function Unavailable() {
    return (
        <section className={`dash-card ${styles.state}`}>
            <StateIcon icon={SearchX} />
            <h1 className={styles.stateTitle}>Esta página de reservas no está disponible</h1>
            <p className={styles.muted}>Verifica el enlace o contacta directamente al profesional.</p>
        </section>
    );
}

export function ErrorState({ error, onRetry, inline = false }: { error: ApiClientError; onRetry: () => void; inline?: boolean }) {
    return (
        <div className={inline ? styles.empty : `dash-card ${styles.state}`} role="alert">
            {!inline && <StateIcon icon={CircleAlert} />}
            <p className={styles.muted}>{error.message}</p>
            <button type="button" className="btn-secondary" onClick={onRetry}>Reintentar</button>
        </div>
    );
}

/** `wide` gives the booking flow the whole phone screen and two panes on desktop. */
export function PublicPageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
    return (
        <main className={wide ? `${styles.page} ${styles.pageWide}` : styles.page}>
            <div className={wide ? styles.containerWide : styles.container}>{children}</div>
        </main>
    );
}
