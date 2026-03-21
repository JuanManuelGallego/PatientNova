import { lbl, btnSecondary, btnPrimary } from "@/src/styles/theme";
import { DateTimePicker } from "../DateTimePicker";
import { Reminder, ReminderStatus, CHANNEL_ICON, CHANNEL_LABEL } from "@/src/types/Reminder";
import { useState } from "react";
import { RequiredField } from "../Info/Requiered";
import { useUpdateReminder } from "@/src/api/useUpdateReminder";

export function EditScheduledReminderModal({ reminder, onClose, onSaved }: { reminder: Reminder; onClose: () => void; onSaved: () => void }) {
    const [ sendAt, setsendAt ] = useState(reminder.sendAt);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const { updateReminder } = useUpdateReminder();

    async function handleSave() {
        setSaving(true); setError(null);
        try {
            const body = {
                sendAt: sendAt,
                status: ReminderStatus.PENDING
            }
            await updateReminder(reminder.id, body);
            onSaved(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally { setSaving(false); }
    }

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: 440, maxWidth: "calc(100vw - 40px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Reprogramar Recordatorio</h2>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                </div>
                <div style={{ background: "#F8F7F4", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "#6B7280" }}>Canal</span>
                        <span style={{ color: "#6B7280", fontWeight: 600 }}>{CHANNEL_ICON[ reminder.channel ]} {CHANNEL_LABEL[ reminder.channel ]}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#6B7280" }}>Destinatario</span>
                        <span style={{ color: "#6B7280", fontWeight: 600 }}>{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</span>
                    </div>
                </div>
                {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>}
                <label style={lbl}>
                    <RequiredField label="Nueva fecha y hora de envío" />
                    <DateTimePicker date={sendAt} onChanged={setsendAt} showTime isFuture />
                </label>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                    <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }} disabled={saving}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
                        {saving ? "Guardando…" : "Reprogramar"}
                    </button>
                </div>
            </div>
        </div>
    );
}