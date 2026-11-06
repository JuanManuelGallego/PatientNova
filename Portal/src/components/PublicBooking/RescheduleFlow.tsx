"use client";

import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useRescheduleAppointment } from "@/src/api/portal/usePortalBooking";
import type { PortalAppointment } from "@/src/types/PortalBooking";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { fmtShortDayTime } from "@/src/utils/publicBooking";
import { SlotChooser } from "./SlotChooser";
import { useSlotChooser } from "./useSlotChooser";
import portal from "./Portal.module.css";

interface RescheduleFlowProps {
    slug: string;
    provider: PublicProvider;
    appointment: PortalAppointment;
    timezone: string;
    onDone: () => void;
    onBack: () => void;
    /** The appointment can no longer be moved online (404 or "Reschedule unavailable"). */
    onGone: (message: string) => void;
    onSessionLost: () => void;
}

/**
 * Picks a new time for one of the patient's online bookings. The appointment being moved is held in
 * the page's state, never in the URL. Same slot rules and device zone as booking.
 */
export function RescheduleFlow({ slug, provider, appointment, timezone, onDone, onBack, onGone, onSessionLost }: RescheduleFlowProps) {
    const picker = useSlotChooser(slug, provider, { rescheduleId: appointment.id }, timezone);
    const { rescheduleAppointment, loading } = useRescheduleAppointment();
    // Tied to the time it was about: choosing another time hides it.
    const [ failure, setFailure ] = useState<{ startUtc: string; message: string } | null>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const { slot } = picker;
    const slotsStatus = picker.error?.status;
    const slotsMessage = picker.error?.message;

    useEffect(() => { heading.current?.focus(); }, []);
    // Loading the times already tells whether the appointment can still be moved. The callbacks are
    // read through a ref so a parent re-render does not fire them again.
    const exits = useRef({ onSessionLost, onGone });
    useEffect(() => { exits.current = { onSessionLost, onGone }; });
    useEffect(() => {
        if (slotsStatus === 401) exits.current.onSessionLost();
        else if ((slotsStatus === 404 || slotsStatus === 409) && slotsMessage) exits.current.onGone(slotsMessage);
    }, [ slotsStatus, slotsMessage ]);

    const submit = async () => {
        if (!slot) return;
        setFailure(null);
        try {
            await rescheduleAppointment(appointment.id, { startUtc: slot.startUtc, patientTimezone: timezone });
            onDone();
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            const details = err.details ?? "";
            if (err.status === 401) onSessionLost();
            else if (/slot no longer available/i.test(details)) picker.slotTaken(err.message);
            else if (err.status === 404 || /reschedule unavailable/i.test(details)) onGone(err.message);
            else setFailure({ startUtc: slot.startUtc, message: err.message });
        }
    };

    return (
        <div className={portal.reschedule}>
            <h2 ref={heading} tabIndex={-1} className={portal.title}>Reprogramar cita</h2>
            <dl className={portal.change} data-testid="reschedule-change">
                <div>
                    <dt>Antes</dt>
                    <dd>{fmtShortDayTime(appointment.startUtc, timezone)}</dd>
                </div>
                <div data-new>
                    <dt>Ahora</dt>
                    <dd>{slot ? fmtShortDayTime(slot.startUtc, timezone) : "Elige un horario"}</dd>
                </div>
            </dl>

            <SlotChooser picker={picker} />

            {slot && failure?.startUtc === slot.startUtc && <p className={`error-inline ${portal.error}`} role="alert">{failure.message}</p>}
            <button type="button" className={`btn-primary ${portal.submit}`} disabled={!slot || loading} onClick={() => void submit()}>
                {loading ? "Reprogramando…" : "Confirmar nuevo horario"}
            </button>
            <button type="button" className={portal.linkButton} disabled={loading} onClick={onBack}>Volver a mis citas</button>
        </div>
    );
}
