import { AppointmentStatus, STATUS_CFG } from "../types/Appointment";
import { PatientStatus, PATIENT_STATUS_CONFIG } from "../types/Patient";
import { ReminderStatus, REMINDER_STATUS_CONFIG } from "../types/Reminder";

export function PatientStatusPill({ status }: { status: PatientStatus }) {
    const c = PATIENT_STATUS_CONFIG[ status ];
    return (
        <span style={{
            display: "inline-block", padding: "3px 12px", borderRadius: 20,
            background: c.bg, color: c.color, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
        }}>
            {c.label}
        </span>
    );
}


export function ReminderStatusPill({ status }: { status: ReminderStatus }) {
    const c = REMINDER_STATUS_CONFIG[ status ];
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 12px", borderRadius: 20,
            background: c.bg, color: c.color, fontSize: 12, fontWeight: 600,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
            {c.label}
        </span>
    );
}

export function AppointmentStatusPill({ status }: { status: AppointmentStatus }) {
    const c = STATUS_CFG[ status ];
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 12px", borderRadius: 20,
            background: c.bg, color: c.color, fontSize: 12, fontWeight: 600,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
            {c.label}
        </span>
    );
}


export function EmptyStatusPill({ label }: { label: string }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 12px", borderRadius: 20,
            background: "#E5E7EB", color: "#6B7280", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
        }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6b728096", flexShrink: 0 }} />
            {label}
        </span>
    );
}