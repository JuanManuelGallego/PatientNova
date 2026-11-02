"use client";

import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useRescheduleAppointment } from "@/src/api/portal/usePortalBooking";
import type { PortalAppointment } from "@/src/types/PortalBooking";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { fmtLongDay, localDayOf } from "@/src/utils/publicBooking";
import { PortalAppointmentCard } from "./PortalAppointmentCard";
import { reveal, SlotSteps, Step, useSlotPicker } from "./SlotPicker";
import portal from "./Portal.module.css";
import styles from "./PublicBooking.module.css";

interface RescheduleFlowProps {
    slug: string;
    provider: PublicProvider;
    appointment: PortalAppointment;
    timezone: string;
    onDone: (updated: PortalAppointment) => void;
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
    const picker = useSlotPicker(slug, provider, appointment.type?.id ?? null, timezone, appointment.id);
    const { rescheduleAppointment, loading } = useRescheduleAppointment();
    // Tied to the time it was about: choosing another time hides it.
    const [ failure, setFailure ] = useState<{ startUtc: string; message: string } | null>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const confirmStep = useRef<HTMLDivElement>(null);
    const noticeRef = useRef<HTMLParagraphElement>(null);
    const { slot, notice } = picker;
    const pickedStart = slot?.startUtc;
    const slotsStatus = picker.error?.status;
    const slotsMessage = picker.error?.message;

    useEffect(() => { heading.current?.focus(); }, []);
    useEffect(() => { if (pickedStart) reveal(confirmStep.current); }, [ pickedStart ]);
    useEffect(() => { if (notice) noticeRef.current?.focus(); }, [ notice ]);
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
            onDone(await rescheduleAppointment(appointment.id, { startUtc: slot.startUtc, patientTimezone: timezone }));
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
            <p className={portal.sectionLabel}>Cita actual</p>
            <PortalAppointmentCard appointment={appointment} timezone={timezone} inset />

            <SlotSteps picker={picker} firstStep={1} noticeRef={noticeRef} />

            {slot && (
                <Step number={3} title="Confirma el cambio" stepRef={confirmStep}>
                    <div className={styles.confirm}>
                        <dl className={styles.summary}>
                            <div>
                                <dt>Antes</dt>
                                <dd>{fmtLongDay(localDayOf(appointment.startUtc, timezone))}, {fmtTime(appointment.startUtc, timezone)}</dd>
                            </div>
                            <div>
                                <dt>Ahora</dt>
                                <dd>{fmtLongDay(localDayOf(slot.startUtc, timezone))}, {fmtTime(slot.startUtc, timezone)}</dd>
                            </div>
                        </dl>
                        {failure?.startUtc === slot.startUtc && <p className={`error-inline ${portal.error}`} role="alert">{failure.message}</p>}
                        <button type="button" className={`btn-primary ${portal.submit}`} disabled={loading} onClick={() => void submit()}>
                            {loading ? "Reprogramando…" : "Confirmar nuevo horario"}
                        </button>
                    </div>
                </Step>
            )}

            <button type="button" className={portal.linkButton} disabled={loading} onClick={onBack}>Volver a mis citas</button>
        </div>
    );
}
