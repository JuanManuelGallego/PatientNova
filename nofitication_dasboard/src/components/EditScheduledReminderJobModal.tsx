import { useState } from "react";
import { lbl, inp, btnSecondary, btnPrimary } from "../styles/theme";
import { API_BASE } from "../types/API";
import { CHANNEL_ICON, CHANNEL_LABEL, Reminder, ReminderStatus } from "../types/Reminder";
import { isoToLocal } from "../utils/TimeUtils";
import { Patient } from "../types/Patient";

export function EditScheduledReminderModal({ reminder, patients, onClose, onSaved }: { reminder: Reminder; patients: Patient[]; onClose: () => void; onSaved: () => void }) {
    const [ sentAt, setsentAt ] = useState(isoToLocal(reminder.sentAt));
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    async function handleSave() {
        setSaving(true); setError(null);
        try {
            const body = {
                sendAt: new Date().toISOString(),
                sentAt: new Date(sentAt).toISOString(),
                status: ReminderStatus.PENDING
            }
            const res = await fetch(`${API_BASE}/reminders/${reminder.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error ?? "Error al reprogramar");
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
                        <span style={{ color: "#6B7280", fontWeight: 600 }}>{patients.find(p => p.id === reminder.patientId)?.fullName ?? "—"}</span>
                    </div>
                </div>
                {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>}
                <label style={lbl}>
                    Nueva fecha y hora de envío
                    <input type="datetime-local" style={inp} value={sentAt} min={new Date().toISOString().slice(0, 16)} onChange={e => setsentAt(e.target.value)} />
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