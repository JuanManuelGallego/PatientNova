"use client";;
import { AppointmentDrawer } from "@/src/components/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/AppointmentModal";
import { CalendarView } from "@/src/components/CalendarView";
import { CancelAppointmentModal } from "@/src/components/CancelAppointmentModal";
import { PayBadge } from "@/src/components/PayBadge";
import Sidebar from "@/src/components/Sidebar";
import { SkeletonRow } from "@/src/components/Skeleton";
import { StatCard } from "@/src/components/StatCard";
import { AppointmentStatusPill, EmptyStatusPill, ReminderStatusPill } from "@/src/components/StatusPill";
import { btnPrimary, btnSecondary, inp, tdStyle, thStyle } from "@/src/styles/theme";
import { Appointment, AppointmentStatus, LOCATION_CFG } from "@/src/types/Appointment";
import { ReminderStatus } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { today, fmtDate } from "@/src/utils/TimeUtils";
import { useState, useEffect } from "react";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { useFetchReminders } from "@/src/api/useFetchReminders";

type ViewMode = "list" | "calendar";

export default function AppointmentsPage() {
  const [ appointments, setAppointments ] = useState<Appointment[]>([]);
  const { patients } = useFetchPatients();
  const { appointments: remoteAppointments, loading, error, fetchAppointments } = useFetchAppointments();
  const { reminders, fetchReminders } = useFetchReminders();

  const [ viewMode, setViewMode ] = useState<ViewMode>("list");
  const [ filterStatus, setFilterStatus ] = useState<AppointmentStatus | "ALL">(AppointmentStatus.SCHEDULED);
  const [ filterPayed, setFilterPayed ] = useState<"ALL" | "true" | "false">("ALL");
  const [ search, setSearch ] = useState("");
  const [ dateFilter, setDateFilter ] = useState("");

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editAppt, setEditAppt ] = useState<Appointment | null>(null);
  const [ viewAppt, setViewAppt ] = useState<Appointment | null>(null);
  const [ deleteAppt, setDeleteAppt ] = useState<Appointment | null>(null);
  const [ payingId, setPayingId ] = useState<string | null>(null);
  const [ prefillDate, setPrefillDate ] = useState<string | null>(null);

  useEffect(() => {
    setAppointments(remoteAppointments);
  }, [ remoteAppointments ]);

  async function handlePay(id: string) {
    setPayingId(id);
    try {
      await fetch(`http://localhost:3001/appointments/${id}/pay`, { method: "POST" });
      fetchAppointments();
    } finally { setPayingId(null); }
  }

  const filtered = appointments.filter(a => {
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterPayed !== "ALL" && String(a.payed) !== filterPayed) return false;
    if (dateFilter && a.date !== dateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [ a.type, a.location, a.patient.name, a.patient.lastName, a.patient.email ].some(v => v.toLowerCase().includes(q));
    }
    return true;
  });

  const counts = {
    total: appointments.length,
    today: appointments.filter(a => a.date === today()).length,
    upcoming: appointments.filter(a => a.date > today() && a.status === AppointmentStatus.SCHEDULED).length,
    unpaid: appointments.filter(a => !a.payed && a.status !== AppointmentStatus.CANCELLED).length,
    completed: appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length,
  };

  const revenue = appointments
    .filter(a => a.payed)
    .reduce((sum, a) => sum + parseFloat(a.price || "0"), 0)
    .toLocaleString("es-ES");
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
        <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6 }}>Citas</h1>
              <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ display: "flex", background: "#fff", borderRadius: 10, padding: 4, gap: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                {([ "list", "calendar" ] as ViewMode[]).map(mode => (
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
              <button onClick={() => { setPrefillDate(null); setShowCreate(true); }} style={{
                ...btnPrimary, display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(30,58,95,0.3)", padding: "12px 24px",
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nueva Cita
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Total" value={counts.total} sub="todas las citas" accent="#1E3A5F" />
            <StatCard label="Hoy" value={counts.today} sub="citas de hoy" accent="#3B82F6" />
            <StatCard label="Próximas" value={counts.upcoming} sub="sin confirmar" accent="#D97706" />
            <StatCard label="Sin pagar" value={counts.unpaid} sub="requieren cobro" accent="#DC2626" />
            <StatCard label="Ingresos" value={`$ ${revenue}`} sub="total cobrado" accent="#16A34A" />
          </div>
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: "#DC2626" }}>⚠️ {error}</span>
              <button onClick={fetchAppointments} style={{ ...btnPrimary, background: "#DC2626", padding: "6px 14px", fontSize: 13 }}>Reintentar</button>
            </div>
          )}
          {viewMode === "list" && (
            <>
              <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                <input placeholder="Buscar paciente, tipo, ubicación…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: "1 1 200px", padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#111827", background: "#FAFAFA" }} />
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...inp, width: "auto", padding: "9px 12px" }} />
                {dateFilter && <button onClick={() => setDateFilter("")} style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>✕ Fecha</button>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([
                    { k: "ALL", l: "Todos" },
                    { k: AppointmentStatus.SCHEDULED, l: "Programadas" },
                    { k: AppointmentStatus.CONFIRMED, l: "Confirmadas" },
                    { k: AppointmentStatus.COMPLETED, l: "Completadas" },
                    { k: AppointmentStatus.CANCELLED, l: "Canceladas" },
                    { k: AppointmentStatus.NO_SHOW, l: "No asistió" },
                  ] as const).map(({ k, l }) => (
                    <button key={k} onClick={() => setFilterStatus(k)} style={{
                      padding: "6px 13px", borderRadius: 8, border: "1.5px solid",
                      borderColor: filterStatus === k ? "#1E3A5F" : "#E5E7EB",
                      background: filterStatus === k ? "#1E3A5F" : "#fff",
                      color: filterStatus === k ? "#fff" : "#6B7280",
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
              <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {[ "Paciente", "Tipo", "Fecha", "Recordatorio", "Ubicación", "Estado", "Pago", "" ].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
                    {!loading && filtered.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                        onClick={() => setViewAppt(a)}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: getAvatarColor(a.patient.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1E3A5F", flexShrink: 0 }}>
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
                        <td style={{ ...tdStyle, fontSize: 12, color: "#000000" }}>{a.reminderId ? <ReminderStatusPill status={reminders.find(r => r.id === a.reminderId)?.status || ReminderStatus.FAILED} /> : <EmptyStatusPill label="Sin Recordatorio" />}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: "#6B7280", maxWidth: 130 }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", backgroundColor: LOCATION_CFG[ a.location ]?.bg || "#F3F4F6", color: LOCATION_CFG[ a.location ]?.color || "#374151", padding: "4px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 12 }}>
                            {a.meetingUrl ? <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#2563EB", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>🔗 Virtual</a> : a.location}
                          </div>
                        </td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}><AppointmentStatusPill status={a.status} /></td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <PayBadge payed={a.payed} />
                            {!a.payed && a.status !== AppointmentStatus.CANCELLED && (
                              <button onClick={() => handlePay(a.id)} disabled={payingId === a.id} style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, background: "#DCFCE7", border: "none", borderRadius: 6, color: "#16A34A", cursor: "pointer", opacity: payingId === a.id ? 0.6 : 1 }}>
                                {payingId === a.id ? "…" : "Pagó"}
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
          {viewMode === "calendar" && (
            <div style={{ animation: "fadeIn 0.25s ease" }}>
              <CalendarView
                appointments={filtered}
                onDayClick={date => { setPrefillDate(date); setShowCreate(true); }}
                onApptClick={a => setViewAppt(a)}
              />
            </div>
          )}
        </main>
      </div>
      {showCreate && (
        <AppointmentModal
          appt={undefined}
          patients={patients}
          onClose={() => { setShowCreate(false); setPrefillDate(null); }}
          onSaved={() => { fetchAppointments(); fetchReminders(); }}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          patients={patients}
          onClose={() => setEditAppt(null)}
          onSaved={() => { fetchAppointments(); fetchReminders(); }}
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
        <CancelAppointmentModal
          appt={deleteAppt}
          onClose={() => setDeleteAppt(null)}
          onCanceled={() => { fetchAppointments(); fetchReminders(); }}
        />
      )}
    </>
  );
}
