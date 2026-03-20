import { useState } from "react";
import { lbl, inp, btnSecondary, btnPrimary, btnDisabled } from "../styles/theme";
import { APPOINTMENT_TYPES } from "../types/Appointment";
import { Patient } from "../types/Patient";
import { CHANNEL_LABEL, CHANNEL_ICON, Channel, ReminderMode, Reminder } from "../types/Reminder";
import { getAvatarColor, getInitials } from "../utils/AvatarHelper";
import { fmtDateTime } from "../utils/TimeUtils";
import { useCreateReminder } from "../api/useCreateReminder";
import { useNotify } from "../api/useNotify";

export function ReminderModal({
    onClose, onSaved, patients, reminder,
}: {
    onClose: () => void;
    onSaved: () => void;
    patients: Patient[];
    reminder?: Reminder;
}) {
    const isEdit = !!reminder;
    const { createReminder } = useCreateReminder();
    const { notify } = useNotify();
    const [ step, setStep ] = useState(1);
    const [ sendMode, setMode ] = useState<ReminderMode>(ReminderMode.IMMEDIATE);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ form, setForm ] = useState({
        patientId: "",
        channel: Channel.WHATSAPP,
        message: "",
        sendAt: "",
        appointmentType: "",
    });

    const isValid = step === 1
        ? !!form.patientId && !!form.appointmentType
        : step === 2 ? !!form.channel && !!form.message.trim() && (sendMode === ReminderMode.SCHEDULED ? !!form.sendAt : true) : true;

    const selectedPatient = patients.find(p => p.id === form.patientId);

    const set = (field: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [ field ]: e.target.value }));

    function validateForm() {
        if (!selectedPatient) {
            setError("Selecciona un paciente");
            return false;
        }
        if (!form.appointmentType) {
            setError("Selecciona un tipo de cita");
            return false;
        }
        if (!form.channel) {
            setError("Selecciona un canal de notificación");
            return false;
        }
        if (!form.message.trim()) {
            setError("El mensaje no puede estar vacío");
            return false;
        }
        if (form.channel === Channel.WHATSAPP && !selectedPatient.whatsappNumber) {
            setError("El paciente no tiene número de WhatsApp");
            return false;
        }
        if (form.channel === Channel.SMS && !selectedPatient.smsNumber) {
            setError("El paciente no tiene número de SMS");
            return false;
        }
        if (sendMode === ReminderMode.SCHEDULED && !form.sendAt) {
            setError("Selecciona fecha y hora de envío");
            return false;
        }
        setError(null);
        return true;
    }

    function buildPayload() {
        const to = form.channel === Channel.WHATSAPP
            ? selectedPatient!.whatsappNumber ?? ""
            : selectedPatient!.smsNumber ?? "";

        return {
            to,
            contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
            contentVariables: {
                "1": "12/1",
                "2": "3pm"
            },
            patientId: form.patientId,
        };
    }

    function buildScheduledPayload() {
        return {
            ...buildPayload(),
            channel: form.channel,
            sendMode: sendMode,
            sendAt: new Date(form.sendAt).toISOString(),
        };
    }

    async function handleSubmit() {
        if (!validateForm()) return;
        setSaving(true); setError(null);
        try {
            if (sendMode === ReminderMode.IMMEDIATE) {
                const body = buildPayload();
                await notify(form.channel, body);
            } else {
                const body = buildScheduledPayload();
                await createReminder(body);
            }
            onSaved(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    const totalSteps = 3;

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)",
            backdropFilter: "blur(4px)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={onClose}>
            <div style={{
                background: "#fff", borderRadius: 20, padding: 36,
                width: 560, maxWidth: "calc(100vw - 40px)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                animation: "slideUp 0.2s ease",
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {isEdit ? "Editar Recordatorio" : "Nuevo Recordatorio"}
                        </h2>
                        <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Paso {step} de {totalSteps}</p>
                    </div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? "#1E3A5F" : "#E5E7EB", transition: "background 0.3s" }} />
                    ))}
                </div>
                {error && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#DC2626" }}>
                        ⚠️ {error}
                    </div>
                )}
                {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Tipo de envío</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {([
                                    { key: ReminderMode.IMMEDIATE, icon: "⚡", title: "Enviar ahora", sub: "Se envía inmediatamente" },
                                    { key: ReminderMode.SCHEDULED, icon: "🗓️", title: "Programar envío", sub: "Elegir fecha y hora" },
                                ] as const).map(opt => (
                                    <button key={opt.key} onClick={() => setMode(opt.key)} style={{
                                        display: "flex", flexDirection: "column", alignItems: "flex-start",
                                        gap: 4, padding: "14px 16px",
                                        border: `2px solid ${sendMode === opt.key ? "#1E3A5F" : "#E5E7EB"}`,
                                        borderRadius: 12,
                                        background: sendMode === opt.key ? "#EFF6FF" : "#fff",
                                        cursor: "pointer", textAlign: "left",
                                    }}>
                                        <span style={{ fontSize: 22 }}>{opt.icon}</span>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{opt.title}</span>
                                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{opt.sub}</span>
                                        {sendMode === opt.key && <span style={{ marginLeft: "auto", color: "#1E3A5F", fontSize: 16, alignSelf: "flex-end" }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <label style={lbl}>
                            Paciente
                            <select style={inp} value={form.patientId} onChange={set("patientId")}>
                                <option value="">Seleccionar paciente…</option>
                                {patients.filter(p => p.status === "ACTIVE").map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </label>
                        <label style={lbl}>
                            Tipo de cita
                            <select style={inp} value={form.appointmentType} onChange={set("appointmentType")}>
                                <option value="">Seleccionar tipo…</option>
                                {APPOINTMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </label>
                    </div>
                )}
                {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {selectedPatient && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 12,
                                background: "#F8F7F4", borderRadius: 12, padding: "12px 16px",
                            }}>
                                <div style={{
                                    width: 38, height: 38, borderRadius: "50%",
                                    background: getAvatarColor(selectedPatient.id),
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 13, fontWeight: 700, color: "#1E3A5F",
                                }}>
                                    {getInitials(selectedPatient.name, selectedPatient.lastName)}
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{selectedPatient.name} {selectedPatient.lastName}</div>
                                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selectedPatient.email}</div>
                                </div>
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Canal de notificación</div>
                            <div style={{ display: "flex", gap: 10 }}>
                                {Object.values(Channel).map(c => {
                                    const available = (c === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) || (c === Channel.SMS && !!selectedPatient?.smsNumber);
                                    return (
                                        <button key={c} onClick={() => available && setForm(f => ({ ...f, channel: c }))} style={{
                                            flex: 1, display: "flex", alignItems: "center", gap: 10,
                                            padding: "12px 16px", borderRadius: 12,
                                            border: `2px solid ${form.channel === c ? "#1E3A5F" : "#E5E7EB"}`,
                                            background: !available ? "#F9FAFB" : form.channel === c ? "#EFF6FF" : "#fff",
                                            cursor: available ? "pointer" : "not-allowed",
                                            opacity: available ? 1 : 0.5,
                                        }}>
                                            <span style={{ fontSize: 22 }}>{CHANNEL_ICON[ c ]}</span>
                                            <div style={{ textAlign: "left" }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{CHANNEL_LABEL[ c ]}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                                    {available
                                                        ? (c === Channel.WHATSAPP ? selectedPatient?.whatsappNumber : selectedPatient?.smsNumber)
                                                        : "No disponible"}
                                                </div>
                                            </div>
                                            {form.channel === c && available && <span style={{ marginLeft: "auto", color: "#1E3A5F" }}>✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {sendMode === ReminderMode.SCHEDULED && <label style={lbl}>
                            Fecha y hora de envío
                            <input type="datetime-local" style={inp} value={form.sendAt} onChange={set("sendAt")} min={new Date().toISOString().slice(0, 16)} />
                        </label>
                        }
                        <label style={lbl}>
                            Mensaje
                            <textarea
                                style={{ ...inp, minHeight: 100, resize: "vertical" }}
                                value={form.message}
                                onChange={set("message")}
                                placeholder={`Hola ${selectedPatient?.name ?? "{nombre}"}, le recordamos su cita${form.appointmentType ? ` de ${form.appointmentType}` : ""} próximamente. Por favor confirme su asistencia.`}
                            />
                            <span style={{ fontSize: 11, color: "#9CA3AF", alignSelf: "flex-end" }}>{form.message.length} / 1600 caracteres</span>
                        </label>
                    </div>
                )}
                {step === 3 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div style={{ background: "#F8F7F4", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Resumen del recordatorio</div>
                            {[
                                { k: "Paciente", v: selectedPatient ? `${selectedPatient.name}` : "—" },
                                { k: "Canal", v: `${CHANNEL_ICON[ form.channel ]} ${CHANNEL_LABEL[ form.channel ]}` },
                                { k: "Enviará a", v: form.channel === Channel.WHATSAPP ? (selectedPatient?.whatsappNumber ?? "—") : (selectedPatient?.smsNumber ?? "—") },
                                { k: "Programado", v: sendMode === ReminderMode.IMMEDIATE ? "Imediatamente" : form.sendAt ? fmtDateTime(form.sendAt) : "—" },
                            ].map(({ k, v }) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ color: "#6B7280" }}>{k}</span>
                                    <span style={{ color: "#111827", fontWeight: 500 }}>{v}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 10, marginTop: 4 }}>
                                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Mensaje</div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{form.message || "—"}</div>
                            </div>
                        </div>
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
                    {step > 1 && <button onClick={() => setStep(s => s - 1)} style={btnSecondary} disabled={saving}>Atrás</button>}
                    {step < totalSteps
                        ? <button onClick={() => { setError(null); setStep(s => s + 1); }} disabled={!isValid} style={isValid ? btnPrimary : btnDisabled}>Continuar →</button>
                        : <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                            {saving ? "Enviando…" : sendMode === ReminderMode.IMMEDIATE ? "⚡ Enviar ahora" : "🗓️ Programar"}
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}
