import { AppointmentStatus, APPT_STATUS_CFG } from "@/src/types/Appointment";
import { PatientStatus, PATIENT_STATUS_CONFIG } from "@/src/types/Patient";
import { ReminderStatus, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";

export function PatientStatusPill({ status }: { status: PatientStatus }) {
    const c = PATIENT_STATUS_CONFIG[ status ];
    return (
        <span className="pill" style={{ background: c.bg, color: c.color }}>
            {c.label}
        </span>
    );
}


export function ReminderStatusPill({ status }: { status: ReminderStatus }) {
    const c = REMINDER_STATUS_CONFIG[ status ];
    return (
        <span className="pill" style={{ background: c.bg, color: c.color }}>
            <span className="pill__dot" style={{ background: c.dot }} />
            {c.label}
        </span>
    );
}

export function AppointmentStatusPill({ status }: { status: AppointmentStatus }) {
    const c = APPT_STATUS_CFG[ status ];
    return (
        <span className="pill" style={{ background: c.bg, color: c.color }}>
            <span className="pill__dot" style={{ background: c.dot }} />
            {c.label}
        </span>
    );
}


export function EmptyStatusPill({ label }: { label: string }) {
    return (
        <span className="pill" style={{ background: "var(--c-gray-200)", color: "var(--c-gray-500)" }}>
            <span className="pill__dot" style={{ background: "rgba(107, 114, 128, 0.6)" }} />
            {label}
        </span>
    );
}
