"use client";

import { useState } from "react";

import Sidebar from '../components/Navigation/Sidebar';
import { Patient, PatientStatus } from "../types/Patient";
import { Channel, CHANNEL_ICON, REMINDER_STATUS_CONFIG, ReminderStatus } from "../types/Reminder";
import { Appointment } from "../types/Appointment";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const PATIENTS: Patient[] = [
  { id: "p1", name: "Marie", lastName: "Tremblay", whatsappNumber: "+1 514-555-0101", smsNumber: "+1 514-555-0101", email: "marie.t@email.com", status: PatientStatus.ACTIVE, createdAt: "2023-01-01", updatedAt: "2023-01-01", avatar: "MT" },
  { id: "p2", name: "James", lastName: "Okafor", whatsappNumber: "+1 514-555-0182", smsNumber: "+1 514-555-0182", email: "j.okafor@email.com", status: PatientStatus.ACTIVE, createdAt: "2023-01-01", updatedAt: "2023-01-01", avatar: "JO" },
  { id: "p3", name: "Sophie", lastName: "Lefebvre", whatsappNumber: "+1 514-555-0234", smsNumber: "+1 514-555-0234", email: "slefebvre@email.com", status: PatientStatus.ACTIVE, createdAt: "2023-01-01", updatedAt: "2023-01-01", avatar: "SL" },
  { id: "p4", name: "Lucas", lastName: "Bergeron", whatsappNumber: "+1 514-555-0356", smsNumber: "+1 514-555-0356", email: "lbergeron@email.com", status: PatientStatus.ACTIVE, createdAt: "2023-01-01", updatedAt: "2023-01-01", avatar: "LB" },
];

const APPOINTMENTS: Appointment[] = [
  {
    id: "a1", patient: PATIENTS[ 0 ], date: "2026-03-16", time: "09:00",
    type: "Revisión General", reminderChannels: [ Channel.SMS, Channel.WHATSAPP ],
    reminderStatus: "scheduled", reminderscheduledSendTime: "2026-03-15 09:00",
  },
  {
    id: "a2", patient: PATIENTS[ 1 ], date: "2026-03-16", time: "10:30",
    type: "Revisión de Análisis de Sangre", reminderChannels: [ Channel.WHATSAPP ],
    reminderStatus: "sent", reminderscheduledSendTime: "2026-03-15 10:30",
  },
  {
    id: "a3", patient: PATIENTS[ 2 ], date: "2026-03-17", time: "14:00",
    type: "Consulta de Seguimiento", reminderChannels: [ Channel.EMAIL ],
    reminderStatus: "pending", reminderscheduledSendTime: "2026-03-16 14:00",
  },
  {
    id: "a4", patient: PATIENTS[ 3 ], date: "2026-03-18", time: "11:00",
    type: "Vacunación", reminderChannels: [ Channel.SMS, Channel.WHATSAPP ],
    reminderStatus: "scheduled", reminderscheduledSendTime: "2026-03-17 11:00",
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      padding: "24px 28px",
      borderLeft: `4px solid ${accent}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 36, fontWeight: 700, color: "#111827", lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</span>
      <span style={{ fontSize: 13, color: "#9CA3AF" }}>{sub}</span>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 20,
      background: "#F3F4F6", fontSize: 12, fontWeight: 500, color: "#374151",
    }}>
      {CHANNEL_ICON[ channel ]} {channel}
    </span>
  );
}

function StatusPill({ status }: { status: ReminderStatus }) {
  const c = REMINDER_STATUS_CONFIG[ status ];
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 12px", borderRadius: 20,
      background: c.bg, color: c.color,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
    }}>
      {c.label}
    </span>
  );
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [ step, setStep ] = useState(1);
  const [ selected, setSelected ] = useState({ patient: "", channels: [] as Channel[], date: "", time: "", type: "" });

  const toggleChannel = (c: Channel) =>
    setSelected(s => ({
      ...s,
      channels: s.channels.includes(c) ? s.channels.filter(x => x !== c) : [ ...s.channels, c ],
    }));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 36, width: 520, maxWidth: "calc(100vw - 40px)",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
              Programar Recordatorio
            </h2>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: "4px 0 0" }}>Paso {step} de 2</p>
          </div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {[ 1, 2 ].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? "#1E3A5F" : "#E5E7EB", transition: "background 0.3s" }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <label style={labelStyle}>
              Paciente
              <select style={inputStyle} value={selected.patient} onChange={e => setSelected(s => ({ ...s, patient: e.target.value }))}>
                <option value="">Seleccionar un paciente…</option>
                {PATIENTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Tipo de Cita
              <input style={inputStyle} placeholder="ej. Revisión General" value={selected.type}
                onChange={e => setSelected(s => ({ ...s, type: e.target.value }))} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={labelStyle}>
                Fecha
                <input type="date" style={inputStyle} value={selected.date}
                  onChange={e => setSelected(s => ({ ...s, date: e.target.value }))} />
              </label>
              <label style={labelStyle}>
                Hora
                <input type="time" style={inputStyle} value={selected.time}
                  onChange={e => setSelected(s => ({ ...s, time: e.target.value }))} />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <p style={{ fontSize: 14, color: "#374151", margin: 0 }}>Seleccionar canales de notificación:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([ "whatsapp", "sms", "email" ] as Channel[]).map(c => (
                <button key={c} onClick={() => toggleChannel(c)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", border: `2px solid ${selected.channels.includes(c) ? "#1E3A5F" : "#E5E7EB"}`,
                  borderRadius: 12, background: selected.channels.includes(c) ? "#EFF6FF" : "#fff",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 22 }}>{CHANNEL_ICON[ c ]}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", textTransform: "capitalize" }}>{c}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                      {c === "whatsapp" ? "Vía Twilio WhatsApp API" : c === "sms" ? "Vía Twilio SMS" : "Vía SendGrid"}
                    </div>
                  </div>
                  {selected.channels.includes(c) && (
                    <span style={{ marginLeft: "auto", color: "#1E3A5F", fontSize: 18 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
            <label style={labelStyle}>
              Enviar recordatorio el
              <input type="datetime-local" style={inputStyle} />
            </label>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{ ...btnSecondary }}>Atrás</button>
          )}
          {step < 2
            ? <button onClick={() => setStep(s => s + 1)} style={{ ...btnPrimary }}>Continuar →</button>
            : <button onClick={onClose} style={{ ...btnPrimary }}>Programar Recordatorio ✓</button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13, fontWeight: 600, color: "#374151",
};
const inputStyle: React.CSSProperties = {
  padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10,
  fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA",
  fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 22px", background: "#1E3A5F", color: "#fff",
  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
  cursor: "pointer", letterSpacing: "0.01em",
};
const btnSecondary: React.CSSProperties = {
  padding: "10px 22px", background: "#F3F4F6", color: "#374151",
  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [ showModal, setShowModal ] = useState(false);
  const [ filterStatus, setFilterStatus ] = useState<ReminderStatus | "all">("all");
  const [ search, setSearch ] = useState("");

  const filtered = APPOINTMENTS.filter(a => {
    const matchStatus = filterStatus === "all" || a.reminderStatus === filterStatus;
    const matchSearch = a.patient.name.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    total: APPOINTMENTS.length,
    scheduled: APPOINTMENTS.filter(a => a.reminderStatus === "scheduled").length,
    sent: APPOINTMENTS.filter(a => a.reminderStatus === "sent").length,
    failed: APPOINTMENTS.filter(a => a.reminderStatus === "failed").length,
  };

  return (
    <>
      <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7F4", fontFamily: "'DM Sans', sans-serif" }}>

        <Sidebar />

        {/* ── Main ────────────────────────────────────────────────────────────── */}
        <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>

          {/* Page Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
            <div>
              <h1 style={{
                fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em",
                fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6,
              }}>
                Recordatorios de Citas
              </h1>
              <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <button onClick={() => setShowModal(true)} style={{
              ...btnPrimary,
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(30,58,95,0.3)",
              padding: "12px 24px", fontSize: 14,
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Programar Recordatorio
            </button>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
            <StatCard label="Total Próximas" value={counts.total} sub="próximos 7 días" accent="#1E3A5F" />
            <StatCard label="Programadas" value={counts.scheduled} sub="en cola de envío" accent="#2563EB" />
            <StatCard label="Enviadas" value={counts.sent} sub="entregadas" accent="#16A34A" />
            <StatCard label="Fallidas" value={counts.failed} sub="requieren atención" accent="#DC2626" />
          </div>

          {/* Filters */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "18px 24px",
            display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <input
              placeholder="Buscar pacientes o tipo de cita…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, padding: "9px 14px", border: "1.5px solid #E5E7EB",
                borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit",
                color: "#111827", background: "#FAFAFA",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              {([ "all", "scheduled", "sent", "pending", "failed" ] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "1.5px solid",
                  borderColor: filterStatus === s ? "#1E3A5F" : "#E5E7EB",
                  background: filterStatus === s ? "#1E3A5F" : "#fff",
                  color: filterStatus === s ? "#fff" : "#6B7280",
                  fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
                  transition: "all 0.15s",
                }}>
                  {s === "all" ? "Todos" : s === "scheduled" ? "Programado" : s === "sent" ? "Enviado" : s === "pending" ? "Pendiente" : "Fallido"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{
            background: "#fff", borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {[ "Paciente", "Cita", "Fecha y Hora", "Canales", "Recordatorio Programado", "Estado", "" ].map(h => (
                    <th key={h} style={{
                      padding: "13px 20px", textAlign: "left",
                      fontSize: 12, fontWeight: 600, color: "#6B7280",
                      letterSpacing: "0.05em", textTransform: "uppercase",
                      borderBottom: "1px solid #F3F4F6",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((appt, i) => (
                  <tr key={appt.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    {/* Patient */}
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: `hsl(${appt.patient.id.charCodeAt(1) * 40}, 60%, 85%)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#1E3A5F", flexShrink: 0,
                        }}>{appt.patient.avatar}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{appt.patient.name} {appt.patient.lastName}</div>
                          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{appt.patient.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Type */}
                    <td style={{ padding: "14px 20px", fontSize: 14, color: "#374151" }}>{appt.type}</td>
                    {/* Date */}
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{formatDate(appt.startAt)}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{appt.time}</div>
                    </td>
                    {/* Channels */}
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {appt.reminderChannels.map(c => <ChannelBadge key={c} channel={c} />)}
                      </div>
                    </td>
                    {/* Scheduled */}
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#6B7280" }}>{appt.reminderscheduledSendTime}</td>
                    {/* Status */}
                    <td style={{ padding: "14px 20px" }}><StatusPill status={appt.reminderStatus} /></td>
                    {/* Actions */}
                    <td style={{ padding: "14px 20px" }}>
                      <button style={{
                        padding: "6px 14px", fontSize: 12, fontWeight: 600,
                        background: "#F3F4F6", border: "none", borderRadius: 8,
                        color: "#374151", cursor: "pointer",
                      }}>Editar</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                      No hay citas que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Modal */}
      {showModal && <ScheduleModal onClose={() => setShowModal(false)} />}
    </>
  );
}
