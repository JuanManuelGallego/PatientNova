import { useUpdateReminder } from "@/src/api/useUpdateReminder";
import { btnSecondary } from "@/src/styles/theme";
import { Reminder, ReminderStatus } from "@/src/types/Reminder";
import { useState } from "react";

export function CancelReminderModal({ reminder, onClose, onCanceled }: {
    reminder: Reminder; onClose: () => void; onCanceled: () => void;
}) {
    const { updateReminder, loading: deleting } = useUpdateReminder();
    const [ error, setError ] = useState<string | null>(null);

    async function handleCancel() {
        setError(null);
        try {
            await updateReminder(reminder.id, { status: ReminderStatus.CANCELLED });
            onCanceled(); onClose();
        } catch (err) { setError(err instanceof Error ? err.message : "Error desconocido"); }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={onClose}>
            <div style={{
                background: "#fff", borderRadius: 20, padding: 36, width: 440, maxWidth: "calc(100vw - 40px)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }} onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🚫</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px", fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Cancelar Recordatorio
                    </h2>
                    <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>
                        ¿Estás seguro que deseas cancelar el recordatorio para <strong>{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</strong>?
                    </p>
                </div>
                {error && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
                        ⚠️ {error}
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }} disabled={deleting}>Regresar</button>
                    <button onClick={handleCancel} disabled={deleting} style={{
                        flex: 1, padding: "10px 22px", background: "#DC2626", color: "#fff",
                        border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                        cursor: "pointer", opacity: deleting ? 0.7 : 1,
                    }}>
                        {deleting ? "Cancelando…" : "Sí, cancelar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
