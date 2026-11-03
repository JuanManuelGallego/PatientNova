import { useId } from "react";
import type { PortalPendingRequest } from "@/src/types/PortalBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { fmtLongDay, localDayOf, locationDetail } from "@/src/utils/publicBooking";
import styles from "./Portal.module.css";

interface PortalRequestCardProps {
    request: PortalPendingRequest;
    timezone: string;
    inset?: boolean;
    actions?: React.ReactNode;
}

/** A booking the provider has not answered yet: the slot is held for the patient meanwhile. */
export function PortalRequestCard({ request: r, timezone, inset = false, actions }: PortalRequestCardProps) {
    const dayId = useId();
    return (
        <article className={inset ? `${styles.appt} ${styles.inset}` : styles.appt} aria-labelledby={dayId}
            data-testid="portal-request-card">
            <div className={styles.apptHead}>
                <div>
                    <p id={dayId} className={styles.apptDay}>{fmtLongDay(localDayOf(r.startUtc, timezone))}</p>
                    <p className={styles.apptTime}>{fmtTime(r.startUtc, timezone)} – {fmtTime(r.endUtc, timezone)}</p>
                </div>
                <span className={styles.status} data-status="PENDING">Pendiente de confirmación</span>
            </div>
            <p className={styles.apptMeta}>{r.type.name} · {r.durationMinutes} minutos</p>
            <p className={styles.apptMeta}>
                {r.location.name}
                {locationDetail(r.location) && <>, {locationDetail(r.location)}</>}
            </p>
            <p className={styles.apptInstructions}>Reservamos este horario para ti. Te avisaremos por correo cuando tu proveedor la confirme.</p>
            {actions && <div className={styles.apptActions}>{actions}</div>}
        </article>
    );
}
