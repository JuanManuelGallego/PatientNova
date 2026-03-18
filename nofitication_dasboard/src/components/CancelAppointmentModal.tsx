import { useState } from "react";
import { btnSecondary } from "../styles/theme";
import { Appointment, AppointmentStatus } from "../types/Appointment";
import { fmtDate } from "../utils/TimeUtils";
import { useUpdateAppointment } from "../api/useUpdateAppointment";
import { useUpdateReminder } from "../api/useUpdateReminder";
import { ReminderStatus } from "../types/Reminder";

export function CancelAppointmentModal({ appt, onClose, onCanceled }: { appt: Appointment; onClose: () => void; onCanceled: () => void }) {
    const { updateAppointment, loading: cancelingAppt } = useUpdateAppointment();
    const { updateReminder, loading: cancelingReminder } = useUpdateReminder();
    const [ error, setError ] = useState<string | null>(null);

    async function handleCancel() {
        setError(null);
        try {
            await updateAppointment(appt.id, { status: AppointmentStatus.CANCELLED });
            if (appt.reminderId) await updateReminder(appt.reminderId, { status: ReminderStatus.CANCELLED });
            onCanceled(); onClose();
        } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    }

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: 440, maxWidth: "calc(100vw - 40px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🚫</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px", fontFamily: "'Playfair Display', Georgia, serif" }}>Cancelar Cita</h2>
                    <p style={{ fontSize: 14, color: "#6B7280" }}>
                        ¿Estás seguro que deseas cancelar la cita de <br /><strong>{appt.patient.name} {appt.patient.lastName}</strong> del <strong>{fmtDate(appt.date)}</strong>?
                    </p>
                </div>
                {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }} disabled={cancelingAppt || cancelingReminder}>Regresar</button>
                    <button onClick={handleCancel} disabled={cancelingAppt || cancelingReminder} style={{ flex: 1, padding: "10px 22px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: cancelingAppt || cancelingReminder ? 0.7 : 1 }}>
                        {cancelingAppt || cancelingReminder ? "Cancelando…" : "Sí, cancelar"}
                    </button>
                </div>
            </div>
        </div>
    );
}