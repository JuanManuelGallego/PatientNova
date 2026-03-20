import { useState } from "react";
import { btnSecondary } from "../styles/theme";
import { Patient } from "../types/Patient";
import { useDeletePatient } from "../api/useDeletePatient";

export function DeletePatientModal({ patient, onClose, onDeleted }: {
    patient: Patient; onClose: () => void; onDeleted: () => void;
}) {
    const { deletePatient, loading: deleting } = useDeletePatient();
    const [ error, setError ] = useState<string | null>(null);

    async function handleDelete() {
        setError(null);
        try {
            await deletePatient(patient.id);
            onDeleted();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        }
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
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px", fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Eliminar Paciente
                    </h2>
                    <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>
                        ¿Estás seguro que deseas eliminar a <strong>{patient.name}</strong>? Esta acción no se puede deshacer.
                    </p>
                </div>
                {error && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
                        ⚠️ {error}
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }} disabled={deleting}>Cancelar</button>
                    <button onClick={handleDelete} disabled={deleting} style={{
                        flex: 1, padding: "10px 22px", background: "#DC2626", color: "#fff",
                        border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                        cursor: "pointer", opacity: deleting ? 0.7 : 1,
                    }}>
                        {deleting ? "Eliminando…" : "Sí, eliminar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
