"use client";

import Sidebar from "@/src/components/Sidebar";
import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
type ViewMode = "list" | "calendar";

interface Patient {
  id: string;
  name: string;
  lastName: string;
  email: string;
  whatsappNumber: string | null;
  smsNumber: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

interface Reminder {
  id: string;
  channel: "WHATSAPP" | "SMS";
  status: string;
  sendAt: string;
}

interface Appointment {
  id: string;
  patientId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  reminderId: string | null;
  type: string;
  location: string;
  meetingUrl: string | null;
  price: string;
  payed: boolean;
  duration: string;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; name: string; lastName: string; email: string };
  reminder: Reminder | null;
}

interface AppointmentForm {
  patientId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  reminderId: string;
  type: string;
  location: string;
  meetingUrl: string;
  price: string;
  payed: boolean;
  duration: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3001";

const APPOINTMENT_TYPES = [
  "Revisión General", "Revisión de Análisis de Sangre", "Consulta de Seguimiento",
  "Vacunación", "Cribado Cardiológico", "Primera Consulta", "Control de Medicamentos",
  "Fisioterapia", "Radiografía", "Consulta de Nutrición", "Ecografía", "Psicología",
];

const DURATIONS = ["15 min", "30 min", "45 min", "1 hora", "1h 30min", "2 horas"];

const STATUS_CFG: Record<AppointmentStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
  SCHEDULED:  { label: "Programada",  color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6", icon: "🗓️" },
  CONFIRMED:  { label: "Confirmada",  color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E", icon: "✅" },
  COMPLETED:  { label: "Completada",  color: "#7C3AED", bg: "#F5F3FF", dot: "#8B5CF6", icon: "🏁" },
  CANCELLED:  { label: "Cancelada",   color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF", icon: "✖️" },
  NO_SHOW:    { label: "No asistió",  color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444", icon: "🚫" },
};

const MONTH_NAMES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAY_NAMES_ES = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

// ─── Shared Styles ────────────────────────────────────────────────────────────

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
  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "10px 22px", background: "#F3F4F6", color: "#374151",
  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const thStyle: React.CSSProperties = {
  padding: "13px 20px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "#6B7280", letterSpacing: "0.06em", textTransform: "uppercase",
  borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "13px 20px" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string, lastName: string) {
  return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
function avatarColor(id: string) {
  const hues = [200, 160, 280, 30, 340, 60, 240];
  return `hsl(${hues[id.charCodeAt(0) % hues.length]}, 55%, 82%)`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, onClick, active }: {
  label: string; value: number | string; sub: string; accent: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <div onClick={onClick} style={{
      background: active ? accent : "#fff",
      borderRadius: 16, padding: "22px 26px",
      borderLeft: `4px solid ${accent}`,
      boxShadow: active
        ? `0 4px 16px ${accent}44`
        : "0 1px 3px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: 5,
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.2s",
    }}>
      <span style={{ fontSize: 11, color: active ? "rgba(255,255,255,0.8)" : "#6B7280", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: active ? "#fff" : "#111827", lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</span>
      <span style={{ fontSize: 12, color: active ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}>{sub}</span>
    </div>
  );
}

function StatusPill({ status }: { status: AppointmentStatus }) {
  const c = STATUS_CFG[status];
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

function PayBadge({ payed }: { payed: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: payed ? "#F0FDF4" : "#FEF9C3",
      color: payed ? "#16A34A" : "#92400E",
    }}>
      {payed ? "💳 Pagado" : "⏳ Pendiente"}
    </span>
  );
}

function SkeletonRow({ cols = 9 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={tdStyle}>
          <div style={{ height: 13, width: [160, 90, 80, 120, 100, 80, 70, 80, 60][i] ?? 80, borderRadius: 6, background: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ appointments, onDayClick, onApptClick }: {
  appointments: Appointment[];
  onDayClick: (date: string) => void;
  onApptClick: (a: Appointment) => void;
}) {
  const [calYear, setCalYear]   = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  // Monday-based offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = startOffset + daysInMonth;
  const rows  = Math.ceil(cells / 7);

  const apptByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [appointments]);

  function cellDate(cell: number): string | null {
    const day = cell - startOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const todayStr = today();

  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      {/* Calendar header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
          style={{ ...btnSecondary, padding: "7px 14px", fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", fontFamily: "'Playfair Display', Georgia, serif" }}>
          {MONTH_NAMES_ES[calMonth]} {calYear}
        </span>
        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
          style={{ ...btnSecondary, padding: "7px 14px", fontSize: 16 }}>›</button>
      </div>

      {/* Day name headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#F9FAFB" }}>
        {DAY_NAMES_ES.map(d => (
          <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em" }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {Array.from({ length: rows * 7 }).map((_, i) => {
          const date = cellDate(i);
          const isToday = date === todayStr;
          const appts   = date ? (apptByDate[date] ?? []) : [];
          return (
            <div key={i} onClick={() => date && onDayClick(date)} style={{
              minHeight: 90, padding: "8px 10px",
              borderRight: (i + 1) % 7 !== 0 ? "1px solid #F3F4F6" : "none",
              borderBottom: i < rows * 7 - 7 ? "1px solid #F3F4F6" : "none",
              background: !date ? "#FAFAFA" : isToday ? "#F0F9FF" : "#fff",
              cursor: date ? "pointer" : "default",
              transition: "background 0.1s",
            }}
              onMouseEnter={e => { if (date) (e.currentTarget as HTMLElement).style.background = isToday ? "#E0F2FE" : "#F9FAFB"; }}
              onMouseLeave={e => { if (date) (e.currentTarget as HTMLElement).style.background = isToday ? "#F0F9FF" : "#fff"; }}
            >
              {date && (
                <>
                  <div style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 500,
                    color: isToday ? "#fff" : "#374151",
                    background: isToday ? "#1E3A5F" : "transparent",
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 4,
                  }}>
                    {parseInt(date.slice(8))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {appts.slice(0, 3).map(a => (
                      <div key={a.id} onClick={e => { e.stopPropagation(); onApptClick(a); }} style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 4,
                        background: STATUS_CFG[a.status].bg,
                        color: STATUS_CFG[a.status].color,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        cursor: "pointer",
                      }}>
                        {a.time} {a.patient.name}
                      </div>
                    ))}
                    {appts.length > 3 && (
                      <div style={{ fontSize: 10, color: "#9CA3AF", paddingLeft: 4 }}>+{appts.length - 3} más</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function AppointmentDrawer({ appt, onClose, onEdit, onPay, onDelete }: {
  appt: Appointment;
  onClose: () => void;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const s = STATUS_CFG[appt.status];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }} onClick={onClose}>
      {/* Overlay */}
      <div style={{ flex: 1, background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }} />
      {/* Drawer */}
      <div style={{
        width: 420, background: "#fff", height: "100%", overflowY: "auto",
        boxShadow: "-10px 0 40px rgba(0,0,0,0.15)", animation: "slideInRight 0.25s ease",
        display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>

        {/* Header strip */}
        <div style={{ background: s.bg, padding: "24px 24px 20px", borderBottom: `3px solid ${s.dot}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{appt.type}</h2>
              <div style={{ marginTop: 8 }}><StatusPill status={appt.status} /></div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

          {/* Patient */}
          <Section title="Paciente">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: avatarColor(appt.patient.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1E3A5F", flexShrink: 0 }}>
                {getInitials(appt.patient.name, appt.patient.lastName)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{appt.patient.name} {appt.patient.lastName}</div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>{appt.patient.email}</div>
              </div>
            </div>
          </Section>

          {/* Date & Time */}
          <Section title="Fecha y Hora">
            <Row icon="📅" label="Fecha"    value={fmtDate(appt.date)} />
            <Row icon="🕐" label="Hora"     value={appt.time} />
            <Row icon="⏱️" label="Duración" value={appt.duration} />
          </Section>

          {/* Location */}
          <Section title="Lugar">
            <Row icon="📍" label="Ubicación" value={appt.location} />
            {appt.meetingUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🔗</span>
                <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2563EB", wordBreak: "break-all" }}>Unirse a la videollamada</a>
              </div>
            )}
          </Section>

          {/* Payment */}
          <Section title="Pago">
            <Row icon="💰" label="Precio" value={`$${appt.price}`} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Row icon="💳" label="Estado" value={<PayBadge payed={appt.payed} />} />
              {!appt.payed && (
                <button onClick={onPay} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12, background: "#16A34A" }}>
                  Marcar pagado
                </button>
              )}
            </div>
          </Section>

          {/* Reminder */}
          {appt.reminder && (
            <Section title="Recordatorio Vinculado">
              <Row icon={appt.reminder.channel === "WHATSAPP" ? "💬" : "📱"} label="Canal" value={appt.reminder.channel} />
              <Row icon="📤" label="Estado" value={appt.reminder.status} />
              <Row icon="🗓️" label="Envío" value={new Date(appt.reminder.sendAt).toLocaleString("es-ES")} />
            </Section>
          )}

          {/* Meta */}
          <Section title="Información del sistema">
            <Row icon="🆔" label="ID" value={<span style={{ fontFamily: "monospace", fontSize: 11 }}>{appt.id}</span>} />
            <Row icon="📆" label="Creada" value={new Date(appt.createdAt).toLocaleString("es-ES")} />
          </Section>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
          <button onClick={onEdit} style={{ ...btnPrimary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            ✏️ Editar
          </button>
          <button onClick={onDelete} style={{
            padding: "10px 16px", background: "#FEF2F2", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 600, color: "#DC2626", cursor: "pointer",
          }}>
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "#6B7280", minWidth: 80 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Appointment Form Modal ───────────────────────────────────────────────────

function AppointmentModal({ appt, patients, reminders, onClose, onSaved }: {
  appt?: Appointment;
  patients: Patient[];
  reminders: Reminder[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!appt;
  const [step, setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [form, setForm] = useState<AppointmentForm>({
    patientId:  appt?.patientId  ?? "",
    date:       appt?.date       ?? today(),
    time:       appt?.time       ?? "09:00",
    status:     appt?.status     ?? "SCHEDULED",
    reminderId: appt?.reminderId ?? "",
    type:       appt?.type       ?? "",
    location:   appt?.location   ?? "",
    meetingUrl: appt?.meetingUrl ?? "",
    price:      appt?.price      ?? "",
    payed:      appt?.payed      ?? false,
    duration:   appt?.duration   ?? "30 min",
  });

  const set = (field: keyof AppointmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const selectedPatient = patients.find(p => p.id === form.patientId);

  async function handleSubmit() {
    setSaving(true); setError(null);
    try {
      const url    = isEdit ? `${API_BASE}/appointments/${appt!.id}` : `${API_BASE}/appointments`;
      const method = isEdit ? "PATCH" : "POST";
      const body   = {
        ...form,
        reminderId: form.reminderId || undefined,
        meetingUrl: form.meetingUrl || undefined,
      };
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Error al guardar");
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally { setSaving(false); }
  }

  const steps = ["Paciente & Tipo", "Lugar & Hora", "Pago & Estado"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: 580, maxWidth: "calc(100vw - 40px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)", animation: "slideUp 0.2s ease" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
              {isEdit ? "Editar Cita" : "Nueva Cita"}
            </h2>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>{steps[step - 1]} — Paso {step} de {steps.length}</p>
          </div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? "#1E3A5F" : "#E5E7EB", transition: "background 0.3s" }} />
          ))}
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>
        )}

        {/* ── Step 1: Patient & Type ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={lbl}>
              Paciente <span style={{ color: "#EF4444" }}>*</span>
              <select style={inp} value={form.patientId} onChange={set("patientId")}>
                <option value="">Seleccionar paciente…</option>
                {patients.filter(p => p.status === "ACTIVE").map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.lastName} — {p.email}</option>
                ))}
              </select>
            </label>

            {selectedPatient && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8F7F4", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(selectedPatient.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1E3A5F" }}>
                  {getInitials(selectedPatient.name, selectedPatient.lastName)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{selectedPatient.name} {selectedPatient.lastName}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selectedPatient.email}</div>
                </div>
              </div>
            )}

            <label style={lbl}>
              Tipo de cita <span style={{ color: "#EF4444" }}>*</span>
              <select style={inp} value={form.type} onChange={set("type")}>
                <option value="">Seleccionar tipo…</option>
                {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label style={lbl}>
              Recordatorio vinculado <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
              <select style={inp} value={form.reminderId} onChange={set("reminderId")}>
                <option value="">Sin recordatorio</option>
                {reminders.filter(r => r.status === "PENDING").map(r => (
                  <option key={r.id} value={r.id}>
                    {r.channel} — {new Date(r.sendAt).toLocaleString("es-ES")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* ── Step 2: Date, Time, Location ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={lbl}>
                Fecha <span style={{ color: "#EF4444" }}>*</span>
                <input type="date" style={inp} value={form.date} onChange={set("date")} />
              </label>
              <label style={lbl}>
                Hora <span style={{ color: "#EF4444" }}>*</span>
                <input type="time" style={inp} value={form.time} onChange={set("time")} />
              </label>
            </div>

            <label style={lbl}>
              Duración
              <select style={inp} value={form.duration} onChange={set("duration")}>
                {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>

            <label style={lbl}>
              Ubicación <span style={{ color: "#EF4444" }}>*</span>
              <input style={inp} value={form.location} onChange={set("location")} placeholder="ej. Consultorio 3, Clínica Central" />
            </label>

            <label style={lbl}>
              URL de videollamada <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
              <input type="url" style={inp} value={form.meetingUrl} onChange={set("meetingUrl")} placeholder="https://meet.example.com/sala" />
            </label>
          </div>
        )}

        {/* ── Step 3: Price, Payment, Status ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={lbl}>
                Precio <span style={{ color: "#EF4444" }}>*</span>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6B7280", fontSize: 14 }}>$</span>
                  <input type="number" step="0.01" style={{ ...inp, paddingLeft: 28 }} value={form.price} onChange={set("price")} placeholder="150.00" />
                </div>
              </label>
              <label style={lbl}>
                Estado
                <select style={inp} value={form.status} onChange={set("status")}>
                  {(Object.keys(STATUS_CFG) as AppointmentStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CFG[s].icon} {STATUS_CFG[s].label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Payment toggle */}
            <div style={{ background: "#F8F7F4", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Estado de pago</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>¿El paciente ya realizó el pago?</div>
                </div>
                <button onClick={() => setForm(f => ({ ...f, payed: !f.payed }))} style={{
                  width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                  background: form.payed ? "#16A34A" : "#D1D5DB",
                  position: "relative", transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: form.payed ? 26 : 3,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
              {form.payed && <div style={{ marginTop: 10, fontSize: 13, color: "#16A34A", fontWeight: 500 }}>✓ Marcado como pagado</div>}
            </div>

            {/* Summary */}
            <div style={{ background: "#F8F7F4", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Resumen</div>
              {[
                ["Paciente",  selectedPatient ? `${selectedPatient.name} ${selectedPatient.lastName}` : "—"],
                ["Tipo",      form.type || "—"],
                ["Fecha",     `${form.date} a las ${form.time}`],
                ["Duración",  form.duration],
                ["Ubicación", form.location || "—"],
                ["Precio",    `$${form.price}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#6B7280" }}>{k}</span>
                  <span style={{ color: "#111827", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={btnSecondary} disabled={saving}>Atrás</button>}
          {step < steps.length
            ? <button onClick={() => { setError(null); setStep(s => s + 1); }} style={btnPrimary}>Continuar →</button>
            : <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "✓ Crear Cita"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ appt, onClose, onDeleted }: { appt: Appointment; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res  = await fetch(`${API_BASE}/appointments/${appt.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Error al eliminar");
      onDeleted(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); setDeleting(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: 440, maxWidth: "calc(100vw - 40px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px", fontFamily: "'Playfair Display', Georgia, serif" }}>Eliminar Cita</h2>
          <p style={{ fontSize: 14, color: "#6B7280" }}>
            ¿Eliminar la cita de <strong>{appt.patient.name} {appt.patient.lastName}</strong> del <strong>{fmtDate(appt.date)}</strong>?
            Considera cambiar el estado a <em>Cancelada</em> para conservar el historial.
          </p>
        </div>
        {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }} disabled={deleting}>Cancelar</button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "10px 22px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.7 : 1 }}>
            {deleting ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients]         = useState<Patient[]>([]);
  const [reminders, setReminders]       = useState<Reminder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [viewMode, setViewMode]           = useState<ViewMode>("list");
  const [filterStatus, setFilterStatus]   = useState<AppointmentStatus | "ALL">("ALL");
  const [filterPayed, setFilterPayed]     = useState<"ALL" | "true" | "false">("ALL");
  const [search, setSearch]               = useState("");
  const [dateFilter, setDateFilter]       = useState("");

  const [showCreate, setShowCreate]       = useState(false);
  const [editAppt, setEditAppt]           = useState<Appointment | null>(null);
  const [viewAppt, setViewAppt]           = useState<Appointment | null>(null);
  const [deleteAppt, setDeleteAppt]       = useState<Appointment | null>(null);
  const [payingId, setPayingId]           = useState<string | null>(null);
  const [prefillDate, setPrefillDate]     = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [apptRes, patRes, remRes] = await Promise.all([
        fetch(`${API_BASE}/appointments?pageSize=200&orderBy=date&order=asc`),
        fetch(`${API_BASE}/patients?pageSize=200`),
        fetch(`${API_BASE}/reminders?pageSize=200`),
      ]);
      const [apptJson, patJson, remJson] = await Promise.all([apptRes.json(), patRes.json(), remRes.json()]);
      if (!apptJson.success) throw new Error(apptJson.error ?? "Error al cargar citas");
      setAppointments(apptJson.data.data);
      if (patJson.success)  setPatients(patJson.data.data);
      if (remJson.success)  setReminders(remJson.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Pay ────────────────────────────────────────────────────────────────────

  async function handlePay(id: string) {
    setPayingId(id);
    try {
      await fetch(`${API_BASE}/appointments/${id}/pay`, { method: "POST" });
      fetchAll();
    } finally { setPayingId(null); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = appointments.filter(a => {
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterPayed  !== "ALL" && String(a.payed) !== filterPayed) return false;
    if (dateFilter && a.date !== dateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [a.type, a.location, a.patient.name, a.patient.lastName, a.patient.email].some(v => v.toLowerCase().includes(q));
    }
    return true;
  });

  const counts = {
    total:     appointments.length,
    today:     appointments.filter(a => a.date === today()).length,
    upcoming:  appointments.filter(a => a.date > today() && a.status === "SCHEDULED").length,
    unpaid:    appointments.filter(a => !a.payed && a.status !== "CANCELLED").length,
    completed: appointments.filter(a => a.status === "COMPLETED").length,
  };

  const revenue = appointments
    .filter(a => a.payed)
    .reduce((sum, a) => sum + parseFloat(a.price || "0"), 0)
    .toFixed(2);

  // ── Render ────────────────────────────────────────────────────────────────

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
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        tr:hover td { background: #F9FAFB !important; transition: background 0.1s; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7F4", fontFamily: "'DM Sans', sans-serif" }}>
        <Sidebar />
        {/* ── Main ────────────────────────────────────────────────────────── */}
        <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>

          {/* Page header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6 }}>Citas</h1>
              <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {/* View toggle */}
              <div style={{ display: "flex", background: "#fff", borderRadius: 10, padding: 4, gap: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                {(["list", "calendar"] as ViewMode[]).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{
                    padding: "7px 14px", border: "none", borderRadius: 8, cursor: "pointer",
                    background: viewMode === mode ? "#1E3A5F" : "transparent",
                    color: viewMode === mode ? "#fff" : "#6B7280",
                    fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                  }}>
                    {mode === "list" ? "☰ Lista" : "📅 Calendario"}
                  </button>
                ))}
              </div>
              <button onClick={fetchAll} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>🔄 Actualizar</button>
              <button onClick={() => { setPrefillDate(null); setShowCreate(true); }} style={{
                ...btnPrimary, display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(30,58,95,0.3)", padding: "12px 24px",
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nueva Cita
              </button>
            </div>
          </div>

          {/* Stat cards — clickable filters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Total"     value={counts.total}     sub="todas las citas"       accent="#1E3A5F" onClick={() => setFilterStatus("ALL")}       active={filterStatus === "ALL"} />
            <StatCard label="Hoy"       value={counts.today}     sub="citas de hoy"          accent="#3B82F6" onClick={() => { setFilterStatus("ALL"); setDateFilter(today()); }} active={dateFilter === today()} />
            <StatCard label="Próximas"  value={counts.upcoming}  sub="sin confirmar"         accent="#D97706" onClick={() => setFilterStatus("SCHEDULED")} active={filterStatus === "SCHEDULED"} />
            <StatCard label="Sin pagar" value={counts.unpaid}    sub="requieren cobro"       accent="#DC2626" onClick={() => setFilterPayed("false")}      active={filterPayed === "false"} />
            <StatCard label="Ingresos"  value={`$${revenue}`}    sub="total cobrado"         accent="#16A34A" />
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: "#DC2626" }}>⚠️ {error}</span>
              <button onClick={fetchAll} style={{ ...btnPrimary, background: "#DC2626", padding: "6px 14px", fontSize: 13 }}>Reintentar</button>
            </div>
          )}

          {/* ── List view ── */}
          {viewMode === "list" && (
            <>
              {/* Filters bar */}
              <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                <input placeholder="Buscar paciente, tipo, ubicación…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: "1 1 200px", padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#111827", background: "#FAFAFA" }} />
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...inp, width: "auto", padding: "9px 12px" }} />
                {dateFilter && <button onClick={() => setDateFilter("")} style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>✕ Fecha</button>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([
                    { k: "ALL",       l: "Todos" },
                    { k: "SCHEDULED", l: "Programadas" },
                    { k: "CONFIRMED", l: "Confirmadas" },
                    { k: "COMPLETED", l: "Completadas" },
                    { k: "CANCELLED", l: "Canceladas" },
                    { k: "NO_SHOW",   l: "No asistió" },
                  ] as const).map(({ k, l }) => (
                    <button key={k} onClick={() => setFilterStatus(k)} style={{
                      padding: "6px 13px", borderRadius: 8, border: "1.5px solid",
                      borderColor: filterStatus === k ? "#1E3A5F" : "#E5E7EB",
                      background:  filterStatus === k ? "#1E3A5F" : "#fff",
                      color:       filterStatus === k ? "#fff"    : "#6B7280",
                      fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                    }}>{l}</button>
                  ))}
                </div>
                <select value={filterPayed} onChange={e => setFilterPayed(e.target.value as "true" | "false" | "ALL")} style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: 13 }}>
                  <option value="ALL">💳 Todos</option>
                  <option value="true">💳 Pagados</option>
                  <option value="false">⏳ Sin pagar</option>
                </select>
              </div>

              {/* Table */}
              <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {["Paciente", "Tipo", "Fecha", "Hora", "Duración", "Ubicación", "Estado", "Pago", ""].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}
                    {!loading && filtered.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                        onClick={() => setViewAppt(a)}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(a.patient.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1E3A5F", flexShrink: 0 }}>
                              {getInitials(a.patient.name, a.patient.lastName)}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{a.patient.name} {a.patient.lastName}</div>
                              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{a.patient.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 13, color: "#374151", maxWidth: 140 }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.type}</div>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 13, color: "#111827", fontWeight: 500, whiteSpace: "nowrap" }}>{fmtDate(a.date)}</td>
                        <td style={{ ...tdStyle, fontSize: 13, color: "#374151" }}>{a.time}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: "#9CA3AF" }}>{a.duration}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: "#6B7280", maxWidth: 130 }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.meetingUrl ? <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#2563EB" }}>🔗 Virtual</a> : a.location}
                          </div>
                        </td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}><StatusPill status={a.status} /></td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <PayBadge payed={a.payed} />
                            {!a.payed && a.status !== "CANCELLED" && (
                              <button onClick={() => handlePay(a.id)} disabled={payingId === a.id} style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, background: "#DCFCE7", border: "none", borderRadius: 6, color: "#16A34A", cursor: "pointer", opacity: payingId === a.id ? 0.6 : 1 }}>
                                {payingId === a.id ? "…" : "Cobrar"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={() => setEditAppt(a)} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: "#EFF6FF", border: "none", borderRadius: 6, color: "#2563EB", cursor: "pointer" }}>Editar</button>
                            <button onClick={() => setDeleteAppt(a)} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: "#FEF2F2", border: "none", borderRadius: 6, color: "#DC2626", cursor: "pointer" }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && !error && filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: 56, textAlign: "center" }}>
                          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Sin resultados</div>
                          <div style={{ fontSize: 13, color: "#9CA3AF" }}>Prueba ajustando los filtros o crea una nueva cita.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {!loading && filtered.length > 0 && (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                      Mostrando <strong style={{ color: "#374151" }}>{filtered.length}</strong> de <strong style={{ color: "#374151" }}>{appointments.length}</strong> citas
                    </span>
                    <span style={{ fontSize: 12, color: "#D1D5DB" }}>Última actualización: {new Date().toLocaleTimeString("es-ES")}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Calendar view ── */}
          {viewMode === "calendar" && (
            <div style={{ animation: "fadeIn 0.25s ease" }}>
              <CalendarView
                appointments={filtered}
                onDayClick={date => { setPrefillDate(date); setShowCreate(true); }}
                onApptClick={a => setViewAppt(a)}
              />
            </div>
          )}

          {/* Footer */}
          <p style={{ marginTop: 24, fontSize: 12, color: "#D1D5DB", textAlign: "center" }}>
            🔒 Datos del paciente cifrados en reposo · Infraestructura compatible con HIPAA · Todas las acciones quedan registradas en auditoría
          </p>
        </main>
      </div>

      {/* Modals & Drawer */}
      {showCreate && (
        <AppointmentModal
          patients={patients}
          reminders={reminders}
          onClose={() => { setShowCreate(false); setPrefillDate(null); }}
          onSaved={fetchAll}
          appt={undefined}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          patients={patients}
          reminders={reminders}
          onClose={() => setEditAppt(null)}
          onSaved={fetchAll}
        />
      )}
      {viewAppt && !editAppt && !deleteAppt && (
        <AppointmentDrawer
          appt={viewAppt}
          onClose={() => setViewAppt(null)}
          onEdit={() => { setEditAppt(viewAppt); setViewAppt(null); }}
          onPay={() => { handlePay(viewAppt.id); setViewAppt(null); }}
          onDelete={() => { setDeleteAppt(viewAppt); setViewAppt(null); }}
        />
      )}
      {deleteAppt && (
        <DeleteModal
          appt={deleteAppt}
          onClose={() => setDeleteAppt(null)}
          onDeleted={fetchAll}
        />
      )}
    </>
  );
}
