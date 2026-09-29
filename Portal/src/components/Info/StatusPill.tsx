import { AppointmentStatus, APPT_STATUS_CFG } from "@/src/types/Appointment";
import { PatientStatus, PATIENT_STATUS_CONFIG } from "@/src/types/Patient";
import { ReminderStatus, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { STATUS_ICONS, type LucideIcon } from "@/src/config/icons";

const REMINDER_STATUS_ICON: Record<
    ReminderStatus,
    { Icon: LucideIcon; color: string }
> = {
    [ReminderStatus.PENDING]: { Icon: STATUS_ICONS.pending, color: "var(--c-warning)" },
    [ReminderStatus.QUEUED]: { Icon: STATUS_ICONS.queued, color: "var(--c-link)" },
    [ReminderStatus.SENT]: { Icon: STATUS_ICONS.sent, color: "var(--c-success)" },
    [ReminderStatus.FAILED]: { Icon: STATUS_ICONS.failed, color: "var(--c-error)" },
    [ReminderStatus.CANCELLED]: { Icon: STATUS_ICONS.cancelled, color: "var(--c-gray-500)" },
};

const APPOINTMENT_STATUS_ICON: Record<
    AppointmentStatus,
    { Icon: LucideIcon; color: string }
> = {
    [AppointmentStatus.SCHEDULED]: { Icon: STATUS_ICONS.scheduled, color: "var(--c-link)" },
    [AppointmentStatus.CONFIRMED]: { Icon: STATUS_ICONS.confirmed, color: "var(--c-success)" },
    [AppointmentStatus.COMPLETED]: { Icon: STATUS_ICONS.completed, color: "var(--c-brand)" },
    [AppointmentStatus.NO_SHOW]: { Icon: STATUS_ICONS.noShow, color: "var(--c-error)" },
    [AppointmentStatus.CANCELLED]: { Icon: STATUS_ICONS.cancelled, color: "var(--c-gray-500)" },
};

const PATIENT_STATUS_ICON: Record<
    PatientStatus,
    { Icon: LucideIcon; color: string }
> = {
    [PatientStatus.ACTIVE]: { Icon: STATUS_ICONS.success, color: "var(--c-success)" },
    [PatientStatus.INACTIVE]: { Icon: STATUS_ICONS.archive, color: "var(--c-warning)" },
};

export function PatientStatusPill({ status }: { status: PatientStatus }) {
    const c = PATIENT_STATUS_CONFIG[ status ];
    const { Icon, color } = PATIENT_STATUS_ICON[ status ];
    return (
        <span className="pill status-icon-pill">
            <Icon size={15} style={{ color }} aria-hidden="true" />
            {c.label}
        </span>
    );
}


export function ReminderStatusPill({ status }: { status: ReminderStatus }) {
    const c = REMINDER_STATUS_CONFIG[ status ];
    const { Icon, color } = REMINDER_STATUS_ICON[ status ];
    return (
        <span className="pill status-icon-pill">
            <Icon size={15} style={{ color }} aria-hidden="true" />
            {c.label}
        </span>
    );
}

export function AppointmentStatusPill({ status }: { status: AppointmentStatus }) {
    const c = APPT_STATUS_CFG[ status ];
    const { Icon, color } = APPOINTMENT_STATUS_ICON[ status ];
    return (
        <span className="pill status-icon-pill">
            <Icon size={15} style={{ color }} aria-hidden="true" />
            {c.label}
        </span>
    );
}


export function EmptyStatusPill({ label }: { label: string }) {
    return (
        <span className="pill status-icon-pill">
            <STATUS_ICONS.none size={15} style={{ color: "var(--c-gray-400)" }} aria-hidden="true" />
            {label}
        </span>
    );
}
