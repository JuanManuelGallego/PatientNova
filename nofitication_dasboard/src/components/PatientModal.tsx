import { useState } from "react";
import { labelStyle, inputStyle, btnSecondary, btnPrimary } from "../styles/theme";
import { API_BASE } from "../types/API";
import { Patient, PatientStatus } from "../types/Patient";

export function PatientModal({
    onClose,
    onSaved,
    patient,
}: {
    onClose: () => void;
    onSaved: () => void;
    patient?: Patient;
}) {
    const isEdit = !!patient;
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ form, setForm ] = useState({
        name: patient?.name ?? "",
        lastName: patient?.lastName ?? "",
        email: patient?.email ?? "",
        whatsappNumber: patient?.whatsappNumber ?? "",
        smsNumber: patient?.smsNumber ?? "",
        status: patient?.status ?? "ACTIVE" as PatientStatus,
    });

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [ field ]: e.target.value }));

    async function handleSubmit() {
        setSaving(true);
        setError(null);
        try {
            const url = isEdit ? `${API_BASE}/patients/${patient!.id}` : `${API_BASE}/patients`;
            const method = isEdit ? "PATCH" : "POST";
            const body = {
                ...form,
                whatsappNumber: form.whatsappNumber || undefined,
                smsNumber: form.smsNumber || undefined,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error ?? "Error al guardar el paciente");
            }

            onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={onClose}>
            <div style={{
                background: "#fff", borderRadius: 20, padding: 36,
                width: 560, maxWidth: "calc(100vw - 40px)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {isEdit ? "Editar Paciente" : "Nuevo Paciente"}
                        </h2>
                        <p style={{ fontSize: 13, color: "#9CA3AF", margin: "4px 0 0" }}>
                            {isEdit ? `Modificando: ${patient!.name} ${patient!.lastName}` : "Registrar un nuevo paciente en el sistema"}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                </div>
                {error && (
                    <div style={{
                        background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
                        padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#DC2626",
                    }}>
                        ⚠️ {error}
                    </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <label style={labelStyle}>
                            Nombre
                            <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="ej. María" />
                        </label>
                        <label style={labelStyle}>
                            Apellido
                            <input style={inputStyle} value={form.lastName} onChange={set("lastName")} placeholder="ej. García" />
                        </label>
                    </div>

                    <label style={labelStyle}>
                        Correo electrónico
                        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="paciente@ejemplo.com" />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <label style={labelStyle}>
                            💬 WhatsApp <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
                            <input style={inputStyle} value={form.whatsappNumber} onChange={set("whatsappNumber")} placeholder="+15551234567" />
                        </label>
                        <label style={labelStyle}>
                            📱 SMS <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
                            <input style={inputStyle} value={form.smsNumber} onChange={set("smsNumber")} placeholder="+15551234567" />
                        </label>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
                    <button onClick={onClose} style={btnSecondary} disabled={saving}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving} style={{
                        ...btnPrimary,
                        opacity: saving ? 0.7 : 1,
                        display: "flex", alignItems: "center", gap: 8,
                    }}>
                        {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Paciente"}
                    </button>
                </div>
            </div>
        </div>
    );
}

