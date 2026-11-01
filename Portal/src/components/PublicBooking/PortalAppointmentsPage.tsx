"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import { usePortalSession } from "@/src/api/portal/usePortalSession";
import { useLogout } from "@/src/api/portal/usePortalAuth";
import type { PortalSession } from "@/src/types/PortalSession";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { PortalLogin } from "./PortalLogin";
import { PortalConsent } from "./PortalConsent";
import styles from "./Portal.module.css";

/** `/book/[slug]/appointments`: OTP login, consent, then the patient's appointments (Phase 4/5). */
export function PortalAppointmentsPage({ slug }: { slug: string }) {
    const { provider, loading, error, retry } = useFetchPublicProvider(slug);

    let body: React.ReactNode;
    if (error?.status === 404) body = <Unavailable />;
    else if (error) body = <ErrorState error={error} onRetry={retry} />;
    else if (loading || !provider) body = <CardSkeleton />;
    else {
        body = (
            <>
                <header className={styles.header}>
                    <Link href={`/book/${encodeURIComponent(slug)}`} className={styles.back}>
                        <ChevronLeft size={18} aria-hidden="true" />
                        Horarios disponibles
                    </Link>
                    <p className={styles.provider}>{provider.displayName}</p>
                </header>
                <PortalArea slug={slug} />
            </>
        );
    }

    return <PublicPageShell>{body}</PublicPageShell>;
}

function PortalArea({ slug }: { slug: string }) {
    const { session, loading, error, refetch, clear } = usePortalSession();
    // Keyed by the session, so a new login (another email) asks again.
    const [ consentedFor, setConsentedFor ] = useState<string | null>(null);

    if (loading) return <CardSkeleton />;
    if (error) return <ErrorState error={error} onRetry={refetch} />;
    // One cookie serves every provider: a session for another provider means "log in here".
    if (!session || session.providerSlug !== slug) return <PortalLogin slug={slug} onLoggedIn={refetch} />;

    const sessionKey = `${session.email}|${session.expiresAt}`;
    if (session.consentRequired && consentedFor !== sessionKey) {
        return <PortalConsent onAccepted={() => setConsentedFor(sessionKey)} onSessionLost={clear} />;
    }
    return <SignedIn session={session} onLoggedOut={clear} />;
}

function SignedIn({ session, onLoggedOut }: { session: PortalSession; onLoggedOut: () => void }) {
    const { logout, loading } = useLogout();

    const onLogout = async () => {
        try {
            await logout();
        } catch {
            // The cookie may survive a failed request, but this tab forgets the session either way.
        }
        onLoggedOut();
    };

    return (
        <section className={`dash-card ${styles.card}`} aria-labelledby="portal-signed-in">
            <h1 id="portal-signed-in" className={styles.title}>Mis citas</h1>
            <p className={styles.lead}>Aquí verás tus citas.</p>
            <div className={styles.account}>
                <span className={styles.muted}>Sesión iniciada como <strong className={styles.email}>{session.email}</strong></span>
                <button type="button" className="btn-secondary" disabled={loading} onClick={() => void onLogout()}>
                    {loading ? "Cerrando…" : "Cerrar sesión"}
                </button>
            </div>
        </section>
    );
}

function CardSkeleton() {
    return (
        <section className={`dash-card ${styles.card}`} aria-busy="true" aria-label="Cargando">
            <div className="skeleton-bar" style={{ width: "40%", height: 24 }} />
            <div className="skeleton-bar" style={{ width: "90%" }} />
            <div className="skeleton-bar" style={{ width: "100%", height: 44 }} />
        </section>
    );
}
