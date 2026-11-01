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
import { ProviderAvatar } from "./ProviderAvatar";
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
                    <div className={styles.identity}>
                        <ProviderAvatar slug={slug} provider={provider} className={styles.avatar} />
                        <div>
                            <p className={styles.providerName}>{provider.displayName}</p>
                            {provider.jobTitle && <p className={styles.jobTitle}>{provider.jobTitle}</p>}
                        </div>
                    </div>
                </header>
                <PortalArea slug={slug} />
            </>
        );
    }

    return <PublicPageShell>{body}</PublicPageShell>;
}

const SESSION_LOST_NOTICE = "Tu sesión expiró. Ingresa de nuevo con tu correo.";

function PortalArea({ slug }: { slug: string }) {
    const { session, loading, error, refetch, clear } = usePortalSession();
    // Keyed by the session, so a new login (another email) asks again.
    const [ consentedFor, setConsentedFor ] = useState<string | null>(null);
    const [ notice, setNotice ] = useState<string | undefined>();

    if (loading) return <CardSkeleton />;
    if (error) return <ErrorState error={error} onRetry={refetch} />;
    // One cookie serves every provider: a session for another provider means "log in here". The
    // server stores slugs lowercased and resolves the URL's slug the same way.
    if (!session || session.providerSlug !== slug.trim().toLowerCase()) {
        return <PortalLogin slug={slug} notice={notice} onLoggedIn={() => { setNotice(undefined); refetch(); }} />;
    }

    const sessionKey = `${session.email}|${session.expiresAt}`;
    if (session.consentRequired && consentedFor !== sessionKey) {
        return (
            <PortalConsent
                onAccepted={() => setConsentedFor(sessionKey)}
                onSessionLost={() => { setNotice(SESSION_LOST_NOTICE); clear(); }}
            />
        );
    }
    return <SignedIn slug={slug} session={session} onLoggedOut={() => { setNotice(undefined); clear(); }} />;
}

function SignedIn({ slug, session, onLoggedOut }: { slug: string; session: PortalSession; onLoggedOut: () => void }) {
    const { logout, loading, error } = useLogout();

    const onLogout = async () => {
        try {
            await logout();
        } catch {
            // The cookie only goes away when the server answers: keep the session on screen with the
            // error so the patient can retry, instead of a fake logout that a reload undoes (shared devices).
            return;
        }
        onLoggedOut();
    };

    return (
        <section className={`dash-card ${styles.card}`} aria-labelledby="portal-signed-in">
            <h1 id="portal-signed-in" className={styles.title}>Mis citas</h1>
            <p className={styles.lead}>Aquí verás tus citas.</p>
            <Link href={`/book/${encodeURIComponent(slug)}`} className={`btn-primary ${styles.submit} ${styles.linkCta}`}>
                Ver horarios disponibles
            </Link>
            {error && <p className={`error-inline ${styles.error}`} role="alert">No pudimos cerrar la sesión. {error}</p>}
            <div className={styles.account}>
                <span className={styles.muted}>Sesión iniciada como <strong className={styles.email}>{session.email}</strong></span>
                <button type="button" className={styles.linkButton} disabled={loading} onClick={() => void onLogout()}>
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
