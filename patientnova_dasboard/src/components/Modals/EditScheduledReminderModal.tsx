import { DateTimePicker } from "../DateTimePicker";
import { Reminder, ReminderStatus, CHANNEL_CFG } from "@/src/types/Reminder";
import { useState } from "react";
import { RequiredField } from "../Info/Required";
import { useUpdateReminder } from "@/src/api/useUpdateReminder";

export function EditScheduledReminderModal({ reminder, onClose, onSaved }: { reminder: Reminder; onClose: () => void; onSaved: () => void }) {
    const [ sendAt, setsendAt ] = useState(reminder.sendAt);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const { updateReminder } = useUpdateReminder();

    async function handleSave() {
        setSaving(true); setError(null);
        try {
            await updateReminder(reminder.id, { sendAt, status: ReminderStatus.PENDING });
            onSaved(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally { setSaving(false); }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title modal-title--sm">Reprogramar Recordatorio</h2>
                    <button onClick={onClose} className="btn-close">✕</button>
                </div>
                <div className="summary-card" style={{ marginBottom: 20 }}>
                    <div className="summary-row">
                        <span className="summary-row__key">Canal</span>
                        <span className="summary-row__value">{CHANNEL_CFG[ reminder.channel ].label}</span>
                    </div>
                    <div className="summary-row">
                        <span className="summary-row__key">Destinatario</span>
                        <span className="summary-row__value">{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</span>
                    </div>
                </div>
                {error && <div className="error-inline">⚠️ {error}</div>}
                <label className="form-label">
                    <RequiredField label="Nueva fecha y hora de envío" />
                    <DateTimePicker date={sendAt} onChanged={setsendAt} showTime isFuture />
                </label>
                <div className="modal-footer modal-footer--stretch">
                    <button onClick={onClose} className="btn-secondary btn-block" disabled={saving}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="btn-primary btn-block">
                        {saving ? "Guardando…" : "Reprogramar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
