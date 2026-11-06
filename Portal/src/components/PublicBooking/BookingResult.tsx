"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CalendarPlus, CircleCheck, Clock } from "lucide-react";
import type { PortalBookingOutcome } from "@/src/types/PortalBooking";
import type { PublicLocation, PublicProvider } from "@/src/types/PublicBooking";
import { downloadAppointmentIcs } from "@/src/utils/appointmentCalendar";
import { APPROVAL_FOLLOW_UP, appointmentsPath, mapUrl, timezoneName } from "@/src/utils/publicBooking";
import { PortalAppointmentCard } from "./PortalAppointmentCard";
import { PortalRequestCard } from "./PortalRequestCard";
import { StateIcon } from "./PublicChrome";
import styles from "./BookingFlow.module.css";

interface BookingResultProps {
    slug: string;
    provider: PublicProvider;
    outcome: PortalBookingOutcome;
    location: PublicLocation | undefined;
    timezone: string;
    onBookAnother: () => void;
}

export function BookingResult({ slug, provider, outcome, location, timezone, onBookAnother }: BookingResultProps) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        window.scrollTo(0, 0);
        heading.current?.focus({ preventScroll: true });
    }, []);

    const directions = location && !location.isVirtual && location.address && (
        <a href={mapUrl(location.address)} target="_blank" rel="noopener noreferrer" className={styles.directions}>Cómo llegar</a>
    );
    const zoneNote = <p className={styles.quiet}>Horas en tu zona horaria: {timezoneName(timezone)}</p>;
    const appointments = <Link href={appointmentsPath(slug)} className={`btn-secondary ${styles.resultAction}`}>Ver mis citas</Link>;

    if ("request" in outcome) {
        return (
            <section className={`${styles.main} ${styles.result}`} aria-labelledby="request-sent" data-testid="request-sent">
                <StateIcon icon={Clock} />
                <h2 id="request-sent" ref={heading} tabIndex={-1} className={styles.title}>Solicitud enviada</h2>
                <p className={styles.quiet}>
                    {provider.displayName} la revisará. Mientras tanto guardamos el horario para ti. {APPROVAL_FOLLOW_UP}
                </p>
                <PortalRequestCard request={outcome.request} timezone={timezone} inset />
                {directions}
                {zoneNote}
                {appointments}
                <button type="button" className={`btn-secondary ${styles.resultAction}`} onClick={onBookAnother}>Enviar otra solicitud</button>
            </section>
        );
    }

    return (
        <section className={`${styles.main} ${styles.result}`} aria-labelledby="booking-done">
            <StateIcon icon={CircleCheck} />
            <h2 id="booking-done" ref={heading} tabIndex={-1} className={styles.title}>Tu cita quedó reservada</h2>
            <p className={styles.quiet}>Te enviamos la confirmación.</p>
            <PortalAppointmentCard appointment={outcome.appointment} timezone={timezone} inset />
            {directions}
            {zoneNote}
            <p className={styles.quiet}>Si algo cambia, puedes gestionar tu cita desde Mis citas.</p>
            <button type="button" className={`btn-primary ${styles.resultAction}`}
                onClick={() => downloadAppointmentIcs(outcome.appointment, provider.displayName, timezone)}>
                <CalendarPlus size={18} aria-hidden="true" />Añadir al calendario
            </button>
            {appointments}
            <button type="button" className={`btn-secondary ${styles.resultAction}`} onClick={onBookAnother}>Reservar otra cita</button>
        </section>
    );
}
