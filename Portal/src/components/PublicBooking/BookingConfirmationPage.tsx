"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarX, Clock, Send } from "lucide-react";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useConfirmBooking, useConfirmationView } from "@/src/api/portal/useBookingConfirmation";
import type { BookingConfirmationView, PortalAppointment } from "@/src/types/PortalBooking";
import { downloadAppointmentIcs } from "@/src/utils/appointmentCalendar";
import { fmtLongDayTime, timezoneName } from "@/src/utils/publicBooking";
import { ProviderContactNotice } from "./ProviderContactNotice";
import { StateIcon } from "./PublicChrome";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import styles from "./Portal.module.css";

const placeOf = ({ location }: BookingConfirmationView) =>
    location.address && !location.isVirtual ? `${location.name}, ${location.address}` : location.name;

function calendarEntry(view: BookingConfirmationView): PortalAppointment {
    const end = new Date(new Date(view.startUtc).getTime() + view.durationMinutes * 60_000).toISOString();
    return {
        id: `cita-${view.startUtc}`,
        startUtc: view.startUtc,
        endUtc: end,
        durationMinutes: view.durationMinutes,
        status: "CONFIRMED",
        price: 0,
        type: { name: view.typeName },
        location: { name: view.location.name, address: view.location.address, instructions: null, isVirtual: view.location.isVirtual },
        meeting: null,
        canCancel: false,
        canReschedule: false,
    };
}

export function BookingConfirmationPage({ token }: { token: string }) {
    const { view: loadView } = useConfirmationView();
    const { confirm, loading: confirming } = useConfirmBooking();
    const [ view, setView ] = useState<BookingConfirmationView | null>(null);
    const [ error, setError ] = useState<ApiClientError | null>(null);
    const [ gone, setGone ] = useState(false);
    const [ attempt, setAttempt ] = useState(0);

    useEffect(() => {
        let cancelled = false;
        loadView(token).then(
            (v) => { if (!cancelled) setView(v); },
            (err) => {
                if (cancelled) return;
                if (err instanceof ApiClientError && err.status === 404) setGone(true);
                else setError(err instanceof ApiClientError ? err : new ApiClientError("No pudimos cargar tu cita. Inténtalo de nuevo.", 0));
            },
        );
        return () => { cancelled = true; };
    }, [ token, attempt, loadView ]);

    const onConfirm = async () => {
        if (!view || confirming) return;
        setError(null);
        try {
            setView(await confirm(token));
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            if (err.status === 409 || err.status === 404) setView({ ...view, state: "unavailable" });
            else setError(err);
        }
    };

    let body: React.ReactNode;
    if (gone) body = <Unavailable />;
    else if (error && !view) body = <ErrorState error={error} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />;
    else if (!view) {
        body = (
            <section className={`dash-card ${styles.card}`} aria-busy="true" aria-label="Cargando">
                <div className="skeleton-bar" style={{ width: "40%", height: 24 }} />
                <div className="skeleton-bar" style={{ width: "90%" }} />
                <div className="skeleton-bar" style={{ width: "100%", height: 44 }} />
            </section>
        );
    } else body = <ConfirmationBody view={view} busy={confirming} error={error?.message ?? null} onConfirm={onConfirm} />;

    return <PublicPageShell>{body}</PublicPageShell>;
}

interface BodyProps {
    view: BookingConfirmationView;
    busy: boolean;
    error: string | null;
    onConfirm: () => void;
}

function ConfirmationBody({ view, busy, error, onConfirm }: BodyProps) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [ view.state ]);

    const zone = view.patientTimezone;
    const contact = { displayName: view.providerName, phone: view.providerContact.phone, whatsapp: view.providerContact.whatsapp };
    const summary = (
        <div className={styles.lead}>
            <p>{view.providerName}</p>
            <p data-testid="confirmation-time">{fmtLongDayTime(view.startUtc, zone)}</p>
            <p>{placeOf(view)}</p>
            <p className={styles.muted}>Horas en tu zona horaria: {timezoneName(zone)}</p>
        </div>
    );
    const title = (text: string) => (
        <h1 id="confirmation-title" ref={heading} tabIndex={-1} className={styles.title}>{text}</h1>
    );
    const card = (testId: string, children: React.ReactNode) => (
        <section className={`dash-card ${styles.card}`} aria-labelledby="confirmation-title" data-testid={testId}>{children}</section>
    );

    switch (view.state) {
        case "unconfirmed":
            return card("confirmation-unconfirmed", (
                <>
                    {title(view.approvalRequired ? "Confirma tu solicitud" : "Confirma tu cita")}
                    {summary}
                    {error && <p className={`error-inline ${styles.error}`} role="alert">{error}</p>}
                    <button type="button" className={`btn-primary ${styles.submit}`} disabled={busy} aria-busy={busy || undefined} onClick={onConfirm}>
                        {busy ? "Confirmando…" : "Confirmar mi cita"}
                    </button>
                    <ProviderContactNotice provider={contact} />
                </>
            ));
        case "confirmed":
            return card("confirmation-confirmed", (
                <>
                    <StateIcon icon={CalendarCheck} />
                    {title("Tu cita está confirmada")}
                    {summary}
                    <button type="button" className="btn-secondary" onClick={() => downloadAppointmentIcs(calendarEntry(view), view.providerName, zone)}>
                        Agregar al calendario
                    </button>
                    <ProviderContactNotice provider={contact} />
                </>
            ));
        case "requested":
            return card("confirmation-requested", (
                <>
                    <StateIcon icon={Send} />
                    {title("Solicitud enviada")}
                    <p className={styles.lead}>Solicitud enviada. {view.providerName} te avisará cuando la confirme.</p>
                    {summary}
                    <ProviderContactNotice provider={contact} />
                </>
            ));
        case "expired":
            return card("confirmation-expired", (
                <>
                    <StateIcon icon={Clock} />
                    {title("El enlace venció")}
                    <p className={styles.lead}>Este enlace venció y el horario quedó libre.</p>
                    {view.providerSlug && (
                        <Link href={`/book/${encodeURIComponent(view.providerSlug)}`} className={`btn-primary ${styles.submit} ${styles.linkCta}`}>
                            Reservar de nuevo
                        </Link>
                    )}
                    <ProviderContactNotice provider={contact} />
                </>
            ));
        case "unavailable":
            return card("confirmation-unavailable", (
                <>
                    <StateIcon icon={CalendarX} />
                    {title("No pudimos confirmar tu cita")}
                    <p className={styles.lead}>No pudimos confirmar tu cita en línea. Comunícate directamente con {view.providerName}.</p>
                    <ProviderContactNotice provider={contact} />
                </>
            ));
    }
}
