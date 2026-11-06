import { useId } from "react";
import type { PortalAppointment } from "@/src/types/PortalBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { fmtLongDay, localDayOf, locationDetail, PENDING_MEETING_LINK_NOTE } from "@/src/utils/publicBooking";
import styles from "./Portal.module.css";

const STATUS_LABEL: Record<PortalAppointment[ "status" ], string> = {
    SCHEDULED: "Programada",
    CONFIRMED: "Confirmada",
    COMPLETED: "Completada",
    CANCELLED: "Cancelada",
    NO_SHOW: "No asistió",
};

interface PortalAppointmentCardProps {
    appointment: PortalAppointment;
    timezone: string;
    inset?: boolean;
    /** Buttons for the patient's actions, shown at the foot of the card. */
    actions?: React.ReactNode;
}

export function PortalAppointmentCard({ appointment: a, timezone, inset = false, actions }: PortalAppointmentCardProps) {
    const dayId = useId();
    return (
        <article className={inset ? `${styles.appt} ${styles.inset}` : styles.appt} aria-labelledby={dayId}>
            <div className={styles.apptHead}>
                <div>
                    <p id={dayId} className={styles.apptDay}>{fmtLongDay(localDayOf(a.startUtc, timezone))}</p>
                    <p className={styles.apptTime}>{fmtTime(a.startUtc, timezone)} – {fmtTime(a.endUtc, timezone)}</p>
                </div>
                <span className={styles.status} data-status={a.status}>{STATUS_LABEL[ a.status ]}</span>
            </div>
            {a.type && <p className={styles.apptMeta}>{a.type.name} · {a.durationMinutes} minutos</p>}
            {a.location && (
                <p className={styles.apptMeta}>
                    {a.location.name}
                    {locationDetail(a.location) && <>, {locationDetail(a.location)}</>}
                </p>
            )}
            {a.meeting?.status === "ready" && (
                <p className={styles.apptMeta}>
                    <a href={a.meeting.url} target="_blank" rel="noopener noreferrer" className={styles.apptLink} data-testid="portal-appointment-meeting-link">
                        Unirse a la videollamada
                    </a>
                </p>
            )}
            {a.meeting?.status === "pending" && (
                <p className={styles.apptInstructions} data-testid="portal-appointment-meeting-pending">
                    {PENDING_MEETING_LINK_NOTE}
                </p>
            )}
            {a.location?.instructions && <p className={styles.apptInstructions}>{a.location.instructions}</p>}
            {actions && <div className={styles.apptActions}>{actions}</div>}
        </article>
    );
}
