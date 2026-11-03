"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarX, ChevronLeft } from "lucide-react";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import { usePortalSession } from "@/src/api/portal/usePortalSession";
import { useLogout } from "@/src/api/portal/usePortalAuth";
import { useCancelAppointment, useCancelRequest, usePortalAppointments } from "@/src/api/portal/usePortalBooking";
import type { PortalAppointment, PortalPendingRequest } from "@/src/types/PortalBooking";
import type { PublicProvider } from "@/src/types/PublicBooking";
import type { PortalSession } from "@/src/types/PortalSession";
import { browserTimezone } from "@/src/utils/TimeUtils";
import { fmtLongDayTime, timezoneName } from "@/src/utils/publicBooking";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { PortalLogin, SESSION_LOST_NOTICE } from "./PortalLogin";
import { PortalAppointmentCard } from "./PortalAppointmentCard";
import { PortalRequestCard } from "./PortalRequestCard";
import { PortalConsent } from "./PortalConsent";
import { ProviderAvatar } from "./ProviderAvatar";
import { RescheduleFlow } from "./RescheduleFlow";
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
                <PortalArea slug={slug} provider={provider} />
            </>
        );
    }

    return <PublicPageShell>{body}</PublicPageShell>;
}

function PortalArea({ slug, provider }: { slug: string; provider: PublicProvider }) {
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
            provider={provider}
            session={session}
            onLoggedOut={() => { setNotice(undefined); clear(); }}
            onSessionLost={() => { setNotice(SESSION_LOST_NOTICE); clear(); }}
        />
    );
}

interface SignedInProps {
    slug: string;
    provider: PublicProvider;
    session: PortalSession;
    onLoggedOut: () => void;
    onSessionLost: () => void;
}

function SignedIn({ slug, provider, session, onLoggedOut, onSessionLost }: SignedInProps) {
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
            <UpcomingAppointments slug={slug} provider={provider} onSessionLost={onSessionLost} />
            {provider.bookingOpen ? (
                <Link href={`/book/${encodeURIComponent(slug)}`} className={`btn-primary ${styles.submit} ${styles.linkCta}`}>
                    Reservar una cita
                </Link>
            ) : (
                <p className={styles.muted} data-testid="portal-booking-paused">Las reservas en línea están en pausa por ahora.</p>
            )}
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

interface UpcomingAppointmentsProps {
    slug: string;
    provider: PublicProvider;
    onSessionLost: () => void;
}

function UpcomingAppointments({ slug, provider, onSessionLost }: UpcomingAppointmentsProps) {
    const timezone = browserTimezone();
    const { appointments, requests, loading, error, retry } = usePortalAppointments();
    const [ rescheduling, setRescheduling ] = useState<PortalAppointment | null>(null);
    const [ cancelling, setCancelling ] = useState<PortalAppointment | null>(null);
    const [ cancellingRequest, setCancellingRequest ] = useState<PortalPendingRequest | null>(null);
    const [ status, setStatus ] = useState<string | null>(null);
    const statusRef = useRef<HTMLParagraphElement>(null);
    const sessionLost = error?.status === 401;

    useEffect(() => { if (sessionLost) onSessionLost(); }, [ sessionLost, onSessionLost ]);
    useEffect(() => { if (status) statusRef.current?.focus(); }, [ status ]);

    /** Shows a result and reloads the list: the server decides what remains. */
    const settle = (message: string) => {
        setRescheduling(null);
        setCancelling(null);
        setCancellingRequest(null);
        setStatus(message);
        retry();
    };

    if (rescheduling) {
        return (
            <RescheduleFlow
                slug={slug}
                provider={provider}
                appointment={rescheduling}
                timezone={timezone}
                onDone={() => settle("Tu cita quedó reprogramada. Te enviamos la confirmación a tu correo.")}
                onBack={() => setRescheduling(null)}
                onGone={settle}
                onSessionLost={onSessionLost}
            />
        );
    }

    // The result line stays mounted (same position) while the list reloads behind it, so it keeps the
    // focus it was given; otherwise focus would drop to the page when the skeleton replaced it.
    const statusLine = status && (
        <p ref={statusRef} tabIndex={-1} className={styles.notice} role="status">{status}</p>
    );

    let body: React.ReactNode;
    if (loading || sessionLost) {
        body = <div className="skeleton-bar" style={{ width: "100%", height: 96 }} aria-busy="true" aria-label="Cargando citas" />;
    } else if (error) {
        body = <ErrorState error={error} onRetry={retry} inline />;
    } else if (!appointments?.length && !requests?.length) {
        body = <p className={styles.lead}>No tienes citas próximas.</p>;
    } else {
        body = (
            <>
                {!!requests?.length && (
                    <ul className={styles.appts} aria-label="Solicitudes pendientes">
                        {requests.map((r) => (
                            <li key={r.id}>
                                <PortalRequestCard
                                    request={r}
                                    timezone={timezone}
                                    actions={(
                                        <button type="button" className={`${styles.linkButton} ${styles.dangerLink}`}
                                            onClick={() => { setStatus(null); setCancellingRequest(r); }}>
                                            Cancelar solicitud
                                        </button>
                                    )}
                                />
                            </li>
                        ))}
                    </ul>
                )}
                {!!appointments?.length && (
                <ul className={styles.appts} aria-label="Próximas citas">
                    {appointments.map((a) => (
                        <li key={a.id}>
                            <PortalAppointmentCard
                                appointment={a}
                                timezone={timezone}
                                actions={(a.canReschedule || a.canCancel) && (
                                    <>
                                        {a.canReschedule && (
                                            <button type="button" className="btn-secondary" onClick={() => { setStatus(null); setRescheduling(a); }}>
                                                Reprogramar
                                            </button>
                                        )}
                                        {a.canCancel && (
                                            <button type="button" className={`${styles.linkButton} ${styles.dangerLink}`}
                                                onClick={() => { setStatus(null); setCancelling(a); }}>
                                                Cancelar cita
                                            </button>
                                        )}
                                    </>
                                )}
                            />
                        </li>
                    ))}
                </ul>
                )}
                <p className={styles.muted}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
                {cancellingRequest && (
                    <CancelRequestDialog
                        request={cancellingRequest}
                        timezone={timezone}
                        onClose={() => setCancellingRequest(null)}
                        onCancelled={() => settle("Tu solicitud quedó cancelada y el horario se liberó.")}
                        onGone={settle}
                        onSessionLost={onSessionLost}
                    />
                )}
                {cancelling && (
                    <CancelDialog
                        appointment={cancelling}
                        timezone={timezone}
                        onClose={() => setCancelling(null)}
                        onCancelled={() => settle("Tu cita quedó cancelada. Te enviamos la confirmación a tu correo.")}
                        onGone={settle}
                        onSessionLost={onSessionLost}
                    />
                )}
            </>
        );
    }

    return <>{statusLine}{body}</>;
}

interface CancelDialogProps {
    appointment: PortalAppointment;
    timezone: string;
    onClose: () => void;
    onCancelled: () => void;
    onGone: (message: string) => void;
    onSessionLost: () => void;
}

/** In-app confirmation (never `window.confirm`). A failure other than "gone" keeps the dialog open with the error. */
function CancelDialog({ appointment, timezone, onClose, onCancelled, onGone, onSessionLost }: CancelDialogProps) {
    const { cancelAppointment, loading, error } = useCancelAppointment();
    const when = fmtLongDayTime(appointment.startUtc, timezone);

    const confirm = async () => {
        try {
            await cancelAppointment(appointment.id);
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            if (err.status === 401) onSessionLost();
            else if (err.status === 404) onGone(err.message);
            return;
        }
        onCancelled();
    };

    // Public pages sit outside the provider layout, so the dialog brings its own focus-trap registry.
    return (
        <FocusTrapProvider>
            <ConfirmDialog
                icon={CalendarX}
                title="¿Cancelar esta cita?"
                cancelLabel="Volver"
                confirmLabel="Sí, cancelar cita"
                loadingLabel="Cancelando…"
                loading={loading}
                error={error}
                onClose={() => { if (!loading) onClose(); }}
                onConfirm={() => void confirm()}
            >
                <p className={styles.lead}>Tu cita del {when} quedará cancelada y el horario se liberará.</p>
            </ConfirmDialog>
        </FocusTrapProvider>
    );
}

interface CancelRequestDialogProps {
    request: PortalPendingRequest;
    timezone: string;
    onClose: () => void;
    onCancelled: () => void;
    onGone: (message: string) => void;
    onSessionLost: () => void;
}

/** Same in-app confirmation as appointments; a 404 means the provider already answered or the hold ran out. */
function CancelRequestDialog({ request, timezone, onClose, onCancelled, onGone, onSessionLost }: CancelRequestDialogProps) {
    const { cancelRequest, loading, error } = useCancelRequest();
    const when = fmtLongDayTime(request.startUtc, timezone);

    const confirm = async () => {
        try {
            await cancelRequest(request.id);
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            if (err.status === 401) onSessionLost();
            else if (err.status === 404) onGone(err.message);
            return;
        }
        onCancelled();
    };

    return (
        <FocusTrapProvider>
            <ConfirmDialog
                icon={CalendarX}
                title="¿Cancelar esta solicitud?"
                cancelLabel="Volver"
                confirmLabel="Sí, cancelar solicitud"
                loadingLabel="Cancelando…"
                loading={loading}
                error={error}
                onClose={() => { if (!loading) onClose(); }}
                onConfirm={() => void confirm()}
            >
                <p className={styles.lead}>Tu solicitud para el {when} quedará cancelada y el horario se liberará.</p>
            </ConfirmDialog>
        </FocusTrapProvider>
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
