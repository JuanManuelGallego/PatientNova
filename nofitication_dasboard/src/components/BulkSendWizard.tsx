import { useState } from "react";
import { lbl, inp, btnPrimary, btnSecondary, thStyle, tdStyle } from "../styles/theme";
import { API_BASE } from "../types/API";
import { Patient } from "../types/Patient";
import { BulkRemindersResult, Channel, CHANNEL_ICON, CHANNEL_LABEL, ReminderMode } from "../types/Reminder";
import { getAvatarColor, getInitials } from "../utils/AvatarHelper";
import { ChannelBadge } from "./ChannelIcon";

export function BulkSendWizard({ patients }: { patients: Patient[] }) {
    const [ step, setStep ] = useState(1);
    const [ channel, setChannel ] = useState<Channel>(Channel.WHATSAPP);
    const [ message, setMessage ] = useState("");
    const [ mode, setMode ] = useState<ReminderMode>(ReminderMode.NOW);
    const [ sendAt, setSendAt ] = useState("");
    const [ selected, setSelected ] = useState<Set<string>>(new Set());
    const [ sending, setSending ] = useState(false);
    const [ results, setResults ] = useState<BulkRemindersResult[]>([]);
    const [ done, setDone ] = useState(false);

    const eligible = patients.filter(p =>
        p.status === "ACTIVE" &&
        (channel === Channel.WHATSAPP ? !!p.whatsappNumber : !!p.smsNumber)
    );

    const toggleAll = () => {
        if (selected.size === eligible.length) setSelected(new Set());
        else setSelected(new Set(eligible.map(p => p.id)));
    };

    const toggleOne = (id: string) => {
        const next = new Set(selected);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    async function handleSend() {
        setSending(true);
        const res: BulkRemindersResult[] = [];
        for (const pid of selected) {
            const p = patients.find(x => x.id === pid)!;
            const to = channel === Channel.WHATSAPP ? p.whatsappNumber : p.smsNumber;
            if (!to) { res.push({ patientId: pid, name: `${p.fullName}`, channel, status: "skipped", reason: "Sin número" }); continue; }
            try {
                const url = mode === ReminderMode.NOW ? `${API_BASE}/notify/${channel}` : `${API_BASE}/notify/schedule`;
                const body = mode === ReminderMode.NOW
                    ? { to, body: message }
                    : { channel, payload: { to, body: message }, sendAt: new Date(sendAt).toISOString() };
                const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const json = await r.json();
                res.push({ patientId: pid, name: `${p.fullName}`, channel, status: json.success ? "ok" : "error", reason: json.error });
            } catch (e) {
                res.push({ patientId: pid, name: `${p.fullName}`, channel, status: "error", reason: String(e) });
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
            {step === 1 && (
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 14 }}>Canal de notificación</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {Object.values(Channel).map(c => (
                                <button key={c} onClick={() => setChannel(c)} style={{
                                    display: "flex", alignItems: "center", gap: 12,
                                    padding: "16px 20px", border: `2px solid ${channel === c ? "#1E3A5F" : "#E5E7EB"}`,
                                    borderRadius: 14, background: channel === c ? "#EFF6FF" : "#fff", cursor: "pointer",
                                }}>
                                    <span style={{ fontSize: 28 }}>{CHANNEL_ICON[ c ]}</span>
                                    <div style={{ textAlign: "left" }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{CHANNEL_LABEL[ c ]}</div>
                                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                                            {patients.filter(p => p.status === "ACTIVE" && (c === Channel.WHATSAPP ? !!p.whatsappNumber : !!p.smsNumber)).length} pacientes disponibles
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
                                { k: ReminderMode.NOW, icon: "⚡", title: "Enviar ahora", sub: "Envío inmediato a todos" },
                                { k: ReminderMode.SCHEDULED, icon: "🗓️", title: "Programar envío", sub: "Elegir fecha y hora" },
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
                    {mode === ReminderMode.SCHEDULED && (
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
                                Ningún paciente activo tiene número de {CHANNEL_LABEL[ channel ]}.
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
                                    background: getAvatarColor(p.id),
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 12, fontWeight: 700, color: "#1E3A5F", flexShrink: 0,
                                }}>
                                    {getInitials(p.name, p.lastName)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.fullName}</div>
                                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{channel === Channel.WHATSAPP ? p.whatsappNumber : p.smsNumber}</div>
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
                            ) : `${mode === ReminderMode.NOW ? "⚡ Enviar" : "🗓️ Programar"} a ${selected.size} pacientes`}
                        </button>
                    </div>
                </div>
            )}
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