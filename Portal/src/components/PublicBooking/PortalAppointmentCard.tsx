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

/** Times in the patient's device zone (`timezone`), never the provider's. */
export function PortalAppointmentCard({ appointment: a, timezone }: { appointment: PortalAppointment; timezone: string }) {
    return (
        <article className={styles.appt} aria-label={`Cita del ${fmtLongDay(localDayOf(a.startUtc, timezone))}`}>
            <div className={styles.apptHead}>
                <div>
                    <p className={styles.apptDay}>{fmtLongDay(localDayOf(a.startUtc, timezone))}</p>
                    <p className={styles.apptTime}>{fmtTime(a.startUtc, timezone)} – {fmtTime(a.endUtc, timezone)}</p>
                </div>
                <span className={styles.status}>{STATUS_LABEL[ a.status ]}</span>
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
