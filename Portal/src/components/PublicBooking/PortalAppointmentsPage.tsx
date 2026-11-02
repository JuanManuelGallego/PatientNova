"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import { usePortalSession } from "@/src/api/portal/usePortalSession";
import { useLogout } from "@/src/api/portal/usePortalAuth";
import { usePortalAppointments } from "@/src/api/portal/usePortalBooking";
import type { PortalSession } from "@/src/types/PortalSession";
import { browserTimezone } from "@/src/utils/TimeUtils";
import { timezoneName } from "@/src/utils/publicBooking";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { PortalLogin, SESSION_LOST_NOTICE } from "./PortalLogin";
import { PortalAppointmentCard } from "./PortalAppointmentCard";
import { PortalConsent } from "./PortalConsent";
import { ProviderAvatar } from "./ProviderAvatar";
import styles from "./Portal.module.css";

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

function PortalArea({ slug }: { slug: string }) {
    const { session, loading, error, refetch, clear } = usePortalSession();
    const [ consentedFor, setConsentedFor ] = useState<string | null>(null);
    const [ notice, setNotice ] = useState<string | undefined>();

    if (loading) return <CardSkeleton />;
    if (error) return <ErrorState error={error} onRetry={refetch} />;
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
    return (
        <SignedIn
            slug={slug}
            session={session}
            onLoggedOut={() => { setNotice(undefined); clear(); }}
            onSessionLost={() => { setNotice(SESSION_LOST_NOTICE); clear(); }}
        />
    );
}

interface SignedInProps {
    slug: string;
    session: PortalSession;
    onLoggedOut: () => void;
    onSessionLost: () => void;
}

function SignedIn({ slug, session, onLoggedOut, onSessionLost }: SignedInProps) {
    const { logout, loading, error } = useLogout();

    const onLogout = async () => {
        try {
            await logout();
        } catch {
            return;
        }
        onLoggedOut();
    };

    return (
        <section className={`dash-card ${styles.card}`} aria-labelledby="portal-signed-in">
            <h1 id="portal-signed-in" className={styles.title}>Mis citas</h1>
            <UpcomingAppointments onSessionLost={onSessionLost} />
            <Link href={`/book/${encodeURIComponent(slug)}`} className={`btn-primary ${styles.submit} ${styles.linkCta}`}>
                Reservar una cita
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

function UpcomingAppointments({ onSessionLost }: { onSessionLost: () => void }) {
    const timezone = browserTimezone();
    const { appointments, loading, error, retry } = usePortalAppointments();
    const sessionLost = error?.status === 401;

    useEffect(() => { if (sessionLost) onSessionLost(); }, [ sessionLost, onSessionLost ]);

    if (loading || sessionLost) {
        return <div className="skeleton-bar" style={{ width: "100%", height: 96 }} aria-busy="true" aria-label="Cargando citas" />;
    }
    if (error) return <ErrorState error={error} onRetry={retry} inline />;
    if (!appointments?.length) return <p className={styles.lead}>No tienes citas próximas.</p>;
    return (
        <>
            <ul className={styles.appts} aria-label="Próximas citas">
                {appointments.map((a) => <li key={a.id}><PortalAppointmentCard appointment={a} timezone={timezone} /></li>)}
            </ul>
            <p className={styles.muted}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
        </>
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
