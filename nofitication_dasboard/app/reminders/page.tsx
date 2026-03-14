"use client";

import Sidebar from '../components/Sidebar';
import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = "whatsapp" | "sms";
type JobStatus = "pending" | "sent" | "failed" | "cancelled";
type ActiveTab = "activos" | "historial" | "masivo";

interface Patient {
    id: string;
    name: string;
    lastName: string;
    whatsappNumber: string | null;
    smsNumber: string | null;
    email: string;
    status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

interface ScheduledJob {
    id: string;
    channel: Channel;
    to: string | null;
    sendAt: string;
    scheduledAt: string;
    status: JobStatus;
    messageSid?: string;
    error?: string;
}

interface BulkResult {
    patientId: string;
    name: string;
    channel: Channel;
    status: "ok" | "error" | "skipped";
    reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3001";

const STATUS_CFG: Record<JobStatus, { label: string; color: string; bg: string; dot: string }> = {
    pending: { label: "Pendiente", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
    sent: { label: "Enviado", color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E" },
    failed: { label: "Fallido", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
    cancelled: { label: "Cancelado", color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const CH_ICON: Record<Channel, string> = { whatsapp: "💬", sms: "📱" };
const CH_LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", sms: "SMS" };

const APPOINTMENT_TYPES = [
    "Revisión General", "Revisión de Análisis de Sangre", "Consulta de Seguimiento",
    "Vacunación", "Cribado Cardiológico", "Primera Consulta", "Control de Medicamentos",
    "Fisioterapia", "Radiografía", "Consulta de Nutrición",
];

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
    padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10,
    fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA",
    fontFamily: "inherit", width: "100%",
};
const lbl: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 6,
    fontSize: 13, fontWeight: 600, color: "#374151",
};
const btnPrimary: React.CSSProperties = {
    padding: "10px 22px", background: "#1E3A5F", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
    padding: "10px 22px", background: "#F3F4F6", color: "#374151",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const thStyle: React.CSSProperties = {
    padding: "13px 20px", textAlign: "left",
    fontSize: 12, fontWeight: 600, color: "#6B7280",
    letterSpacing: "0.05em", textTransform: "uppercase",
    borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "14px 20px" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string, lastName: string) {
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
function avatarColor(id: string) {
    const hues = [ 200, 160, 280, 30, 340, 60, 240 ];
    return `hsl(${hues[ id.charCodeAt(0) % hues.length ]}, 55%, 82%)`;
}
function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString("es-ES", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}
function fmtRelative(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    if (abs < 60_000) return "Ahora mismo";
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)} min`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)} h`;
    return `${Math.round(abs / 86_400_000)} días`;
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent: string }) {
    return (
        <div style={{
            background: "#fff", borderRadius: 16, padding: "24px 28px",
            borderLeft: `4px solid ${accent}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            display: "flex", flexDirection: "column", gap: 6,
        }}>
            <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ fontSize: 34, fontWeight: 700, color: "#111827", lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</span>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>{sub}</span>
        </div>
    );
}

function StatusPill({ status }: { status: JobStatus }) {
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

function ChannelBadge({ channel }: { channel: Channel }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20,
            background: "#F3F4F6", fontSize: 12, fontWeight: 500, color: "#374151",
        }}>
            {CH_ICON[ channel ]} {CH_LABEL[ channel ]}
        </span>
    );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <tr>
            <td colSpan={10} style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>{sub}</div>
            </td>
        </tr>
    );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
    return (
        <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12,
            padding: "14px 20px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
            <span style={{ fontSize: 14, color: "#DC2626" }}>⚠️ {msg}</span>
            <button onClick={onRetry} style={{ ...btnPrimary, background: "#DC2626", padding: "6px 14px", fontSize: 13 }}>Reintentar</button>
        </div>
    );
}

// ─── Reminder Form Modal ──────────────────────────────────────────────────────

function ReminderModal({
    onClose, onSaved, patients, job,
}: {
    onClose: () => void;
    onSaved: () => void;
    patients: Patient[];
    job?: ScheduledJob;
}) {
    const isEdit = !!job;
    const [ step, setStep ] = useState(1);
    const [ mode, setMode ] = useState<"now" | "scheduled">("scheduled");
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ form, setForm ] = useState({
        patientId: "",
        channel: "whatsapp" as Channel,
        message: "",
        sendAt: "",
        appointmentType: "",
    });

    const selectedPatient = patients.find(p => p.id === form.patientId);

    const set = (field: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [ field ]: e.target.value }));

    function buildPayload() {
        if (!selectedPatient) throw new Error("Selecciona un paciente");
        const to = form.channel === "whatsapp"
            ? selectedPatient.whatsappNumber
            : selectedPatient.smsNumber;
        if (!to) throw new Error(`El paciente no tiene número de ${CH_LABEL[ form.channel ]}`);
        if (!form.message.trim()) throw new Error("El mensaje no puede estar vacío");

        return {
            channel: form.channel,
            payload: { to, body: form.message },
            ...(mode === "scheduled" && { sendAt: new Date(form.sendAt).toISOString() }),
        };
    }

    async function handleSubmit() {
        setSaving(true); setError(null);
        try {
            const body = buildPayload();
            const url = mode === "now"
                ? `${API_BASE}/notify/${form.channel}`
                : `${API_BASE}/notify/schedule`;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mode === "now" ? body.payload : body),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error ?? "Error al guardar");
            onSaved(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    const totalSteps = mode === "scheduled" ? 3 : 2;

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

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {isEdit ? "Editar Recordatorio" : "Nuevo Recordatorio"}
                        </h2>
                        <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Paso {step} de {totalSteps}</p>
                    </div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                </div>

                {/* Progress bar */}
                <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? "#1E3A5F" : "#E5E7EB", transition: "background 0.3s" }} />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#DC2626" }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* ── Step 1 — Mode + Patient ── */}
                {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {/* Send mode toggle */}
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Tipo de envío</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {([
                                    { key: "now", icon: "⚡", title: "Enviar ahora", sub: "Se envía inmediatamente" },
                                    { key: "scheduled", icon: "🗓️", title: "Programar envío", sub: "Elegir fecha y hora" },
                                ] as const).map(opt => (
                                    <button key={opt.key} onClick={() => setMode(opt.key)} style={{
                                        display: "flex", flexDirection: "column", alignItems: "flex-start",
                                        gap: 4, padding: "14px 16px",
                                        border: `2px solid ${mode === opt.key ? "#1E3A5F" : "#E5E7EB"}`,
                                        borderRadius: 12,
                                        background: mode === opt.key ? "#EFF6FF" : "#fff",
                                        cursor: "pointer", textAlign: "left",
                                    }}>
                                        <span style={{ fontSize: 22 }}>{opt.icon}</span>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{opt.title}</span>
                                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{opt.sub}</span>
                                        {mode === opt.key && <span style={{ marginLeft: "auto", color: "#1E3A5F", fontSize: 16, alignSelf: "flex-end" }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Patient selector */}
                        <label style={lbl}>
                            Paciente
                            <select style={inp} value={form.patientId} onChange={set("patientId")}>
                                <option value="">Seleccionar paciente…</option>
                                {patients.filter(p => p.status === "ACTIVE").map(p => (
                                    <option key={p.id} value={p.id}>{p.name} {p.lastName}</option>
                                ))}
                            </select>
                        </label>

                        {/* Appointment type */}
                        <label style={lbl}>
                            Tipo de cita <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(referencia)</span>
                            <select style={inp} value={form.appointmentType} onChange={set("appointmentType")}>
                                <option value="">Seleccionar tipo…</option>
                                {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </label>
                    </div>
                )}

                {/* ── Step 2 — Channel + Message ── */}
                {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {/* Patient summary */}
                        {selectedPatient && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 12,
                                background: "#F8F7F4", borderRadius: 12, padding: "12px 16px",
                            }}>
                                <div style={{
                                    width: 38, height: 38, borderRadius: "50%",
                                    background: avatarColor(selectedPatient.id),
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

                        {/* Channel selector */}
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Canal de notificación</div>
                            <div style={{ display: "flex", gap: 10 }}>
                                {([ "whatsapp", "sms" ] as Channel[]).map(c => {
                                    const available = (c === "whatsapp" && !!selectedPatient?.whatsappNumber) || (c === "sms" && !!selectedPatient?.smsNumber);
                                    return (
                                        <button key={c} onClick={() => available && setForm(f => ({ ...f, channel: c }))} style={{
                                            flex: 1, display: "flex", alignItems: "center", gap: 10,
                                            padding: "12px 16px", borderRadius: 12,
                                            border: `2px solid ${form.channel === c ? "#1E3A5F" : "#E5E7EB"}`,
                                            background: !available ? "#F9FAFB" : form.channel === c ? "#EFF6FF" : "#fff",
                                            cursor: available ? "pointer" : "not-allowed",
                                            opacity: available ? 1 : 0.5,
                                        }}>
                                            <span style={{ fontSize: 22 }}>{CH_ICON[ c ]}</span>
                                            <div style={{ textAlign: "left" }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{CH_LABEL[ c ]}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                                    {available
                                                        ? (c === "whatsapp" ? selectedPatient?.whatsappNumber : selectedPatient?.smsNumber)
                                                        : "No disponible"}
                                                </div>
                                            </div>
                                            {form.channel === c && available && <span style={{ marginLeft: "auto", color: "#1E3A5F" }}>✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Message */}
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
                {/* ── Step 3 — Schedule (only when mode=scheduled) ── */}
                {step === 3 && mode === "scheduled" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <label style={lbl}>
                            Fecha y hora de envío
                            <input type="datetime-local" style={inp} value={form.sendAt} onChange={set("sendAt")} min={new Date().toISOString().slice(0, 16)} />
                        </label>

                        {/* Summary card */}
                        <div style={{ background: "#F8F7F4", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Resumen del recordatorio</div>
                            {[
                                { k: "Paciente", v: selectedPatient ? `${selectedPatient.name} ${selectedPatient.lastName}` : "—" },
                                { k: "Canal", v: `${CH_ICON[ form.channel ]} ${CH_LABEL[ form.channel ]}` },
                                { k: "Enviará a", v: form.channel === "whatsapp" ? (selectedPatient?.whatsappNumber ?? "—") : (selectedPatient?.smsNumber ?? "—") },
                                { k: "Programado", v: form.sendAt ? fmtDateTime(form.sendAt) : "—" },
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

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
                    {step > 1 && <button onClick={() => setStep(s => s - 1)} style={btnSecondary} disabled={saving}>Atrás</button>}
                    {step < totalSteps
                        ? <button onClick={() => { setError(null); setStep(s => s + 1); }} style={btnPrimary}>Continuar →</button>
                        : <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                            {saving ? "Enviando…" : mode === "now" ? "⚡ Enviar ahora" : "🗓️ Programar"}
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}

// ─── Edit Scheduled Job Modal ─────────────────────────────────────────────────

function EditJobModal({ job, onClose, onSaved }: { job: ScheduledJob; onClose: () => void; onSaved: () => void }) {
    const [ sendAt, setSendAt ] = useState(job.sendAt.slice(0, 16));
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    async function handleSave() {
        setSaving(true); setError(null);
        try {
            // Cancel old + reschedule — API doesn't have a PATCH for jobs, so cancel & recreate
            await fetch(`${API_BASE}/notify/schedule/${job.id}`, { method: "DELETE" });
            const res = await fetch(`${API_BASE}/notify/schedule`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel: job.channel,
                    payload: { to: job.to, body: "Recordatorio de su cita próxima." },
                    sendAt: new Date(sendAt).toISOString(),
                }),
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
                        <span style={{ fontWeight: 600 }}>{CH_ICON[ job.channel ]} {CH_LABEL[ job.channel ]}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#6B7280" }}>Destinatario</span>
                        <span style={{ fontWeight: 600 }}>{job.to ?? "—"}</span>
                    </div>
                </div>

                {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>}

                <label style={lbl}>
                    Nueva fecha y hora de envío
                    <input type="datetime-local" style={inp} value={sendAt} min={new Date().toISOString().slice(0, 16)} onChange={e => setSendAt(e.target.value)} />
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

// ─── Bulk Send Wizard ─────────────────────────────────────────────────────────

function BulkSendTab({ patients }: { patients: Patient[] }) {
    const [ step, setStep ] = useState(1);
    const [ channel, setChannel ] = useState<Channel>("whatsapp");
    const [ message, setMessage ] = useState("");
    const [ mode, setMode ] = useState<"now" | "scheduled">("now");
    const [ sendAt, setSendAt ] = useState("");
    const [ selected, setSelected ] = useState<Set<string>>(new Set());
    const [ sending, setSending ] = useState(false);
    const [ results, setResults ] = useState<BulkResult[]>([]);
    const [ done, setDone ] = useState(false);

    const eligible = patients.filter(p =>
        p.status === "ACTIVE" &&
        (channel === "whatsapp" ? !!p.whatsappNumber : !!p.smsNumber)
    );

    const toggleAll = () => {
        if (selected.size === eligible.length) setSelected(new Set());
        else setSelected(new Set(eligible.map(p => p.id)));
    };

    const toggleOne = (id: string) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    async function handleSend() {
        setSending(true);
        const res: BulkResult[] = [];
        for (const pid of selected) {
            const p = patients.find(x => x.id === pid)!;
            const to = channel === "whatsapp" ? p.whatsappNumber : p.smsNumber;
            if (!to) { res.push({ patientId: pid, name: `${p.name} ${p.lastName}`, channel, status: "skipped", reason: "Sin número" }); continue; }
            try {
                const url = mode === "now" ? `${API_BASE}/notify/${channel}` : `${API_BASE}/notify/schedule`;
                const body = mode === "now"
                    ? { to, body: message }
                    : { channel, payload: { to, body: message }, sendAt: new Date(sendAt).toISOString() };
                const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const json = await r.json();
                res.push({ patientId: pid, name: `${p.name} ${p.lastName}`, channel, status: json.success ? "ok" : "error", reason: json.error });
            } catch (e) {
                res.push({ patientId: pid, name: `${p.name} ${p.lastName}`, channel, status: "error", reason: String(e) });
            }
        }
        setResults(res);
        setSending(false);
        setDone(true);
        setStep(4);
    }

    function reset() { setStep(1); setSelected(new Set()); setMessage(""); setResults([]); setDone(false); }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Progress steps */}
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {[ "Canal", "Pacientes", "Mensaje", "Resultado" ].map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
                        <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                            minWidth: 70,
                        }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: "50%",
                                background: step > i + 1 ? "#1E3A5F" : step === i + 1 ? "#3B82F6" : "#E5E7EB",
                                color: step >= i + 1 ? "#fff" : "#9CA3AF",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 13, fontWeight: 700,
                            }}>
                                {step > i + 1 ? "✓" : i + 1}
                            </div>
                            <span style={{ fontSize: 11, color: step === i + 1 ? "#1E3A5F" : "#9CA3AF", fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
                        </div>
                        {i < 3 && <div style={{ flex: 1, height: 2, background: step > i + 1 ? "#1E3A5F" : "#E5E7EB", marginBottom: 18, transition: "background 0.3s" }} />}
                    </div>
                ))}
            </div>

            {/* ── Step 1: Channel & Mode ── */}
            {step === 1 && (
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Canal de notificación</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {([ "whatsapp", "sms" ] as Channel[]).map(c => (
                                <button key={c} onClick={() => setChannel(c)} style={{
                                    display: "flex", alignItems: "center", gap: 12,
                                    padding: "16px 20px", border: `2px solid ${channel === c ? "#1E3A5F" : "#E5E7EB"}`,
                                    borderRadius: 14, background: channel === c ? "#EFF6FF" : "#fff", cursor: "pointer",
                                }}>
                                    <span style={{ fontSize: 28 }}>{CH_ICON[ c ]}</span>
                                    <div style={{ textAlign: "left" }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{CH_LABEL[ c ]}</div>
                                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                                            {patients.filter(p => p.status === "ACTIVE" && (c === "whatsapp" ? !!p.whatsappNumber : !!p.smsNumber)).length} pacientes disponibles
                                        </div>
                                    </div>
                                    {channel === c && <span style={{ marginLeft: "auto", color: "#1E3A5F", fontSize: 18 }}>✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Tipo de envío</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {([
                                { k: "now", icon: "⚡", title: "Enviar ahora", sub: "Envío inmediato a todos" },
                                { k: "scheduled", icon: "🗓️", title: "Programar envío", sub: "Elegir fecha y hora" },
                            ] as const).map(opt => (
                                <button key={opt.k} onClick={() => setMode(opt.k)} style={{
                                    display: "flex", flexDirection: "column", gap: 4, padding: "14px 18px",
                                    border: `2px solid ${mode === opt.k ? "#1E3A5F" : "#E5E7EB"}`,
                                    borderRadius: 14, background: mode === opt.k ? "#EFF6FF" : "#fff", cursor: "pointer", textAlign: "left",
                                }}>
                                    <span style={{ fontSize: 22 }}>{opt.icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{opt.title}</span>
                                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{opt.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {mode === "scheduled" && (
                        <label style={lbl}>
                            Fecha y hora de envío
                            <input type="datetime-local" style={inp} value={sendAt} onChange={e => setSendAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                        </label>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={() => setStep(2)} style={btnPrimary}>Continuar →</button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Patient selection ── */}
            {step === 2 && (
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Seleccionar pacientes</div>
                            <div style={{ fontSize: 13, color: "#9CA3AF" }}>{selected.size} de {eligible.length} seleccionados</div>
                        </div>
                        <button onClick={toggleAll} style={{ ...btnSecondary, padding: "7px 16px", fontSize: 13 }}>
                            {selected.size === eligible.length ? "Deseleccionar todos" : "Seleccionar todos"}
                        </button>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                        {eligible.length === 0 && (
                            <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 14 }}>
                                Ningún paciente activo tiene número de {CH_LABEL[ channel ]}.
                            </div>
                        )}
                        {eligible.map(p => (
                            <div key={p.id} onClick={() => toggleOne(p.id)} style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                                border: `1.5px solid ${selected.has(p.id) ? "#1E3A5F" : "#E5E7EB"}`,
                                background: selected.has(p.id) ? "#EFF6FF" : "#FAFAFA",
                                transition: "all 0.1s",
                            }}>
                                <div style={{
                                    width: 18, height: 18, borderRadius: 4,
                                    border: `2px solid ${selected.has(p.id) ? "#1E3A5F" : "#D1D5DB"}`,
                                    background: selected.has(p.id) ? "#1E3A5F" : "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 11, color: "#fff", flexShrink: 0,
                                }}>
                                    {selected.has(p.id) && "✓"}
                                </div>
                                <div style={{
                                    width: 34, height: 34, borderRadius: "50%",
                                    background: avatarColor(p.id),
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 12, fontWeight: 700, color: "#1E3A5F", flexShrink: 0,
                                }}>
                                    {getInitials(p.name, p.lastName)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.name} {p.lastName}</div>
                                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{channel === "whatsapp" ? p.whatsappNumber : p.smsNumber}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <button onClick={() => setStep(1)} style={btnSecondary}>Atrás</button>
                        <button onClick={() => setStep(3)} disabled={selected.size === 0} style={{ ...btnPrimary, opacity: selected.size === 0 ? 0.5 : 1 }}>
                            Continuar → ({selected.size})
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 3: Message ── */}
            {step === 3 && (
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Redactar mensaje</div>
                    <label style={lbl}>
                        Mensaje
                        <textarea
                            style={{ ...inp, minHeight: 120, resize: "vertical" }}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Estimado/a paciente, le recordamos su cita médica próxima. Por favor confirme su asistencia respondiendo a este mensaje."
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF" }}>
                            <span>{message.length} / 1600 caracteres</span>
                            <span>{selected.size} destinatarios</span>
                        </div>
                    </label>
                    {/* Quick templates */}
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Plantillas rápidas</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[
                                "Le recordamos su próxima cita médica. Por favor confirme su asistencia respondiendo este mensaje.",
                                "Su cita está confirmada para mañana. Recuerde traer su tarjeta de seguro y llegar 10 minutos antes.",
                                "Importante: No olvide su cita de mañana. Si necesita cancelar, contáctenos con 24 horas de anticipación.",
                            ].map((tmpl, i) => (
                                <button key={i} onClick={() => setMessage(tmpl)} style={{
                                    background: "#F8F7F4", border: "1.5px solid #E5E7EB", borderRadius: 10,
                                    padding: "10px 14px", textAlign: "left", cursor: "pointer", fontSize: 13, color: "#374151",
                                    lineHeight: 1.5,
                                }}>
                                    {tmpl}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button onClick={() => setStep(2)} style={btnSecondary}>Atrás</button>
                        <button onClick={handleSend} disabled={!message.trim() || sending} style={{
                            ...btnPrimary, opacity: (!message.trim() || sending) ? 0.7 : 1,
                            display: "flex", alignItems: "center", gap: 8,
                        }}>
                            {sending ? (
                                <>
                                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                                    Enviando {results.length}/{selected.size}…
                                </>
                            ) : `${mode === "now" ? "⚡ Enviar" : "🗓️ Programar"} a ${selected.size} pacientes`}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 4: Results ── */}
            {step === 4 && done && (
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                        {[
                            { label: "Enviados", value: results.filter(r => r.status === "ok").length, color: "#16A34A", bg: "#F0FDF4" },
                            { label: "Fallidos", value: results.filter(r => r.status === "error").length, color: "#DC2626", bg: "#FEF2F2" },
                            { label: "Omitidos", value: results.filter(r => r.status === "skipped").length, color: "#D97706", bg: "#FFFBEB" },
                        ].map(({ label, value, color, bg }) => (
                            <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</div>
                                <div style={{ fontSize: 12, color, fontWeight: 500 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                    {/* Detail table */}
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#F9FAFB" }}>
                                    {[ "Paciente", "Canal", "Resultado", "Detalle" ].map(h => (
                                        <th key={h} style={{ ...thStyle, fontSize: 11 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                                        <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{r.name}</span></td>
                                        <td style={tdStyle}><ChannelBadge channel={r.channel} /></td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                                                background: r.status === "ok" ? "#F0FDF4" : r.status === "error" ? "#FEF2F2" : "#FFFBEB",
                                                color: r.status === "ok" ? "#16A34A" : r.status === "error" ? "#DC2626" : "#D97706",
                                            }}>
                                                {r.status === "ok" ? "✓ Enviado" : r.status === "error" ? "✗ Error" : "— Omitido"}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, fontSize: 12, color: "#9CA3AF" }}>{r.reason ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={reset} style={btnPrimary}>Nuevo envío masivo</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecordatoriosPage() {
    const [ activeTab, setActiveTab ] = useState<ActiveTab>("activos");
    const [ jobs, setJobs ] = useState<ScheduledJob[]>([]);
    const [ patients, setPatients ] = useState<Patient[]>([]);
    const [ loadingJobs, setLoadingJobs ] = useState(true);
    const [ errorJobs, setErrorJobs ] = useState<string | null>(null);
    const [ showCreate, setShowCreate ] = useState(false);
    const [ editJob, setEditJob ] = useState<ScheduledJob | null>(null);
    const [ search, setSearch ] = useState("");

    // ── Data fetching ───────────────────────────────────────────────────────────

    const fetchJobs = useCallback(async () => {
        setLoadingJobs(true); setErrorJobs(null);
        try {
            const res = await fetch(`${API_BASE}/notify/schedule`);
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error ?? "Error al cargar recordatorios");
            setJobs(json.data.jobs ?? []);
        } catch (err) {
            setErrorJobs(err instanceof Error ? err.message : "Error desconocido");
        } finally { setLoadingJobs(false); }
    }, []);

    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/patients`);
            const json = await res.json();
            if (json.success) setPatients(json.data.data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchJobs(); fetchPatients(); }, [ fetchJobs, fetchPatients ]);

    async function cancelJob(id: string) {
        try {
            await fetch(`${API_BASE}/notify/schedule/${id}`, { method: "DELETE" });
            fetchJobs();
        } catch { /* silent */ }
    }

    // ── Derived ────────────────────────────────────────────────────────────────

    const active = jobs.filter(j => j.status === "pending");
    const history = jobs.filter(j => j.status !== "pending");

    const filteredActive = active.filter(j =>
        !search || (j.to ?? "").includes(search) || j.channel.includes(search)
    );
    const filteredHistory = history.filter(j =>
        !search || (j.to ?? "").includes(search) || j.channel.includes(search)
    );

    const counts = {
        active: active.length,
        sent: jobs.filter(j => j.status === "sent").length,
        failed: jobs.filter(j => j.status === "failed").length,
        cancelled: jobs.filter(j => j.status === "cancelled").length,
    };

    // ── Skeleton ───────────────────────────────────────────────────────────────

    const SkeletonRow = () => (
        <tr>
            {[ 160, 100, 140, 120, 80, 90 ].map((w, i) => (
                <td key={i} style={tdStyle}>
                    <div style={{ height: 13, width: w, borderRadius: 6, background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                </td>
            ))}
        </tr>
    );

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        tr:hover td { background: #F9FAFB !important; transition: background 0.1s; }
      `}</style>

            <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7F4", fontFamily: "'DM Sans', sans-serif" }}>

                <Sidebar />


                {/* ── Main ────────────────────────────────────────────────────────── */}
                <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>

                    {/* Page header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
                        <div>
                            <h1 style={{ fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6 }}>
                                Recordatorios
                            </h1>
                            <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowCreate(true)} style={{
                                ...btnPrimary, display: "flex", alignItems: "center", gap: 8,
                                boxShadow: "0 4px 14px rgba(30,58,95,0.3)", padding: "12px 24px",
                            }}>
                                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuevo Recordatorio
                            </button>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
                        <StatCard label="Activos" value={counts.active} sub="en cola de envío" accent="#2563EB" />
                        <StatCard label="Enviados" value={counts.sent} sub="entregados" accent="#16A34A" />
                        <StatCard label="Fallidos" value={counts.failed} sub="requieren atención" accent="#DC2626" />
                        <StatCard label="Cancelados" value={counts.cancelled} sub="fuera de la cola" accent="#9CA3AF" />
                    </div>

                    {/* Tabs */}
                    <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 5, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", width: "fit-content" }}>
                        {([
                            { key: "activos", label: "Activos", badge: counts.active },
                            { key: "historial", label: "Historial", badge: counts.sent + counts.failed + counts.cancelled },
                            { key: "masivo", label: "Envío Masivo", badge: null },
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                padding: "9px 20px", borderRadius: 9, border: "none", cursor: "pointer",
                                background: activeTab === tab.key ? "#1E3A5F" : "transparent",
                                color: activeTab === tab.key ? "#fff" : "#6B7280",
                                fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
                                transition: "all 0.15s",
                            }}>
                                {tab.label}
                                {tab.badge !== null && (
                                    <span style={{
                                        background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F3F4F6",
                                        color: activeTab === tab.key ? "#fff" : "#374151",
                                        fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                                    }}>{tab.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab: Activos ── */}
                    {activeTab !== "masivo" && (
                        <div style={{
                            background: "#fff", borderRadius: 16, padding: "18px 24px",
                            display: "flex", alignItems: "center", gap: 16, marginBottom: 16,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}>
                            <input
                                placeholder="Buscar por número, canal…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1, padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#111827", background: "#FAFAFA" }}
                            />
                        </div>
                    )}

                    {errorJobs && activeTab !== "masivo" && <ErrorBanner msg={errorJobs} onRetry={fetchJobs} />}

                    {/* Activos table */}
                    {activeTab === "activos" && (
                        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#F9FAFB" }}>
                                        {[ "Destinatario", "Canal", "Estado", "Programado para", "En", "Creado el", "" ].map(h => (
                                            <th key={h} style={thStyle}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingJobs && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                                    {!loadingJobs && filteredActive.map((job, i) => (
                                        <tr key={job.id} style={{ borderBottom: i < filteredActive.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.to ?? "—"}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{job.id.slice(0, 10)}…</div>
                                            </td>
                                            <td style={tdStyle}><ChannelBadge channel={job.channel} /></td>
                                            <td style={tdStyle}><StatusPill status={job.status} /></td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#374151" }}>{fmtDateTime(job.sendAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                                <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                                    {fmtRelative(job.sendAt)}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#9CA3AF" }}>{fmtDateTime(job.scheduledAt)}</td>
                                            <td style={tdStyle}>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button onClick={() => setEditJob(job)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#EFF6FF", border: "none", borderRadius: 7, color: "#2563EB", cursor: "pointer" }}>
                                                        Reprogramar
                                                    </button>
                                                    <button onClick={() => cancelJob(job.id)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#FEF2F2", border: "none", borderRadius: 7, color: "#DC2626", cursor: "pointer" }}>
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loadingJobs && filteredActive.length === 0 && (
                                        <EmptyState icon="🔔" title="Sin recordatorios activos" sub="Haz clic en Nuevo Recordatorio para programar el primero." />
                                    )}
                                </tbody>
                            </table>
                            {!loadingJobs && filteredActive.length > 0 && (
                                <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                        <strong style={{ color: "#374151" }}>{filteredActive.length}</strong> recordatorio(s) activo(s)
                                    </span>
                                    <span style={{ fontSize: 12, color: "#D1D5DB" }}>Actualizado: {new Date().toLocaleTimeString("es-ES")}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Historial table */}
                    {activeTab === "historial" && (
                        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#F9FAFB" }}>
                                        {[ "Destinatario", "Canal", "Estado", "Programado", "Enviado / Fallado", "ID Mensaje", "Error" ].map(h => (
                                            <th key={h} style={thStyle}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingJobs && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                                    {!loadingJobs && filteredHistory.map((job, i) => (
                                        <tr key={job.id} style={{ borderBottom: i < filteredHistory.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.to ?? "—"}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{job.id.slice(0, 10)}…</div>
                                            </td>
                                            <td style={tdStyle}><ChannelBadge channel={job.channel} /></td>
                                            <td style={tdStyle}><StatusPill status={job.status} /></td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280" }}>{fmtDateTime(job.sendAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280" }}>{fmtDateTime(job.scheduledAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 12, color: "#9CA3AF", fontFamily: "monospace" }}>
                                                {job.messageSid ? (
                                                    <span title={job.messageSid}>{job.messageSid.slice(0, 16)}…</span>
                                                ) : "—"}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 12, color: "#DC2626", maxWidth: 200 }}>
                                                {job.error
                                                    ? <span title={job.error} style={{ background: "#FEF2F2", padding: "3px 8px", borderRadius: 6 }}>{job.error.slice(0, 40)}{job.error.length > 40 ? "…" : ""}</span>
                                                    : <span style={{ color: "#D1D5DB" }}>—</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                    {!loadingJobs && filteredHistory.length === 0 && (
                                        <EmptyState icon="📋" title="Sin historial aún" sub="Los recordatorios enviados, fallidos y cancelados aparecerán aquí." />
                                    )}
                                </tbody>
                            </table>
                            {!loadingJobs && filteredHistory.length > 0 && (
                                <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                        <strong style={{ color: "#374151" }}>{filteredHistory.length}</strong> registros en el historial
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bulk send tab */}
                    {activeTab === "masivo" && (
                        <div style={{ animation: "fadeIn 0.25s ease" }}>
                            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>📣</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1E40AF", marginBottom: 3 }}>Envío Masivo</div>
                                    <div style={{ fontSize: 13, color: "#3B82F6" }}>
                                        Envía el mismo mensaje a múltiples pacientes a la vez. Solo se incluyen pacientes con estado <strong>Activo</strong> y número registrado para el canal seleccionado.
                                    </div>
                                </div>
                            </div>
                            <BulkSendTab patients={patients} />
                        </div>
                    )}

                    {/* Footer */}
                    <p style={{ marginTop: 24, fontSize: 12, color: "#D1D5DB", textAlign: "center" }}>
                        🔒 Datos del paciente cifrados en reposo · Infraestructura compatible con HIPAA · Todas las acciones quedan registradas en auditoría
                    </p>
                </main>
            </div>

            {/* Modals */}
            {showCreate && (
                <ReminderModal patients={patients} onClose={() => setShowCreate(false)} onSaved={fetchJobs} />
            )}
            {editJob && (
                <EditJobModal job={editJob} onClose={() => setEditJob(null)} onSaved={fetchJobs} />
            )}
        </>
    );
}
