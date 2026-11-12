"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { useReleaseBooking } from "@/src/api/portal/useBookingConfirmation";
import type { BookingPending } from "@/src/types/PortalBooking";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { appointmentsPath, fmtContact, fmtLongDayTime, timezoneName } from "@/src/utils/publicBooking";
import { ProviderContactNotice } from "./ProviderContactNotice";
import { StateIcon } from "./PublicChrome";
import styles from "./BookingFlow.module.css";

interface BookingResultProps {
    slug: string;
    provider: PublicProvider;
    pending: BookingPending;
    timezone: string;
    onCorrect: () => void;
}

export function BookingResult({ slug, provider, pending, timezone, onCorrect }: BookingResultProps) {
    const heading = useRef<HTMLHeadingElement>(null);
    const { release, loading } = useReleaseBooking();
    useEffect(() => {
        window.scrollTo(0, 0);
        heading.current?.focus({ preventScroll: true });
    }, []);

    const byEmail = pending.channel === "EMAIL";
    const lead = pending.approvalRequired ? "Tu solicitud todavía no se ha enviado." : "Tu cita todavía no está confirmada.";

    const correct = async () => {
        if (loading) return;
        try {
            await release(pending.releaseToken);
        } catch {
        }
        onCorrect();
    };

    return (
        <section className={`${styles.main} ${styles.result}`} aria-labelledby="booking-pending" data-testid="booking-pending">
            <StateIcon icon={byEmail ? Mail : MessageCircle} />
            <h2 id="booking-pending" ref={heading} tabIndex={-1} className={styles.title}>{byEmail ? "Revisa tu correo" : "Revisa tu WhatsApp"}</h2>
            <p className={styles.quiet}>
                {lead} Te enviamos un enlace a <strong>{fmtContact(pending.contact, pending.channel)}</strong>.
                Ábrelo y confirma en los próximos 15 minutos; si no, el horario quedará libre.
            </p>
            <p className={styles.quiet} data-testid="pending-time">{fmtLongDayTime(pending.startUtc, timezone)}</p>
            <p className={styles.quiet}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            {provider.selfServe
                ? <Link href={appointmentsPath(slug)} className={`btn-secondary ${styles.resultAction}`}>Ver mis citas</Link>
                : <ProviderContactNotice provider={provider} />}
            <button type="button" className={`btn-secondary ${styles.resultAction}`} disabled={loading} aria-busy={loading || undefined} onClick={correct}>
                ¿Te equivocaste? Corregir
            </button>
        </section>
    );
}
