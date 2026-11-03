import { useId } from "react";
import type { PortalPendingRequest } from "@/src/types/PortalBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { APPROVAL_FOLLOW_UP, fmtLongDay, fmtLongDayTime, localDayOf, locationDetail } from "@/src/utils/publicBooking";
import styles from "./Portal.module.css";

interface PortalRequestCardProps {
    request: PortalPendingRequest;
    timezone: string;
    inset?: boolean;
    actions?: React.ReactNode;
}

export function PortalRequestCard({ request: r, timezone, inset = false, actions }: PortalRequestCardProps) {
    const dayId = useId();
    const className = [ styles.appt, styles.request, inset && styles.inset ].filter(Boolean).join(" ");
    return (
        <article className={className} aria-labelledby={dayId} data-testid="portal-request-card">
            <div className={styles.apptHead}>
                <div>
                    <p id={dayId} className={styles.apptDay}>{fmtLongDay(localDayOf(r.startUtc, timezone))}</p>
                    <p className={styles.apptTime}>{fmtTime(r.startUtc, timezone)} – {fmtTime(r.endUtc, timezone)}</p>
                </div>
                <span className={styles.status} data-status="PENDING">Pendiente</span>
            </div>
            <p className={styles.apptMeta}>{r.type.name} · {r.durationMinutes} minutos</p>
            <p className={styles.apptMeta}>
                {r.location.name}
                {locationDetail(r.location) && <>, {locationDetail(r.location)}</>}
            </p>
            <p className={styles.apptInstructions}>
                Guardamos este horario para ti hasta el {fmtLongDayTime(r.holdExpiresAt, timezone)}. {APPROVAL_FOLLOW_UP}
            </p>
            {actions && <div className={styles.apptActions}>{actions}</div>}
        </article>
    );
}
