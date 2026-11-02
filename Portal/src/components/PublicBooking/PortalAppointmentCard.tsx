import { useId } from "react";
import type { PortalAppointment } from "@/src/types/PortalBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { fmtLongDay, localDayOf } from "@/src/utils/publicBooking";
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
}

export function PortalAppointmentCard({ appointment: a, timezone, inset = false }: PortalAppointmentCardProps) {
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
                    {a.location.address && <>, {a.location.address}</>}
                </p>
            )}
            {a.location?.instructions && <p className={styles.apptInstructions}>{a.location.instructions}</p>}
        </article>
    );
}
