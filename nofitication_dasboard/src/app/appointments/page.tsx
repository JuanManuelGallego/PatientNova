"use client";;
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CalendarView } from "@/src/components/Navigation/CalendarView";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import { PayBadge } from "@/src/components/Info/PayBadge";
import Sidebar from "@/src/components/Navigation/Sidebar";
import { DataTable } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { StatCard } from "@/src/components/Info/StatCard";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { btnPrimary, btnSecondary, inp, tdStyle } from "@/src/styles/theme";
import { Appointment, AppointmentStatus, FetchAppointmentsFilters, LOCATION_CFG } from "@/src/types/Appointment";
import { ReminderStatus } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { fmtDateAndTime } from "@/src/utils/TimeUtils";
import { useState, useMemo } from "react";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { useFetchReminders } from "@/src/api/useFetchReminders";
import { ReminderStatusPill, EmptyStatusPill, AppointmentStatusPill } from "@/src/components/Info/StatusPill";
import { useFetchAppointmentsStats } from "@/src/api/useFetchAppointmentsStats";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useDebounceState } from "@/src/utils/useDebounceState";

type ViewMode = "list" | "calendar";
const PAGE_SIZE = 10;

export default function AppointmentsPage() {
  const { patients } = useFetchPatients();
  const { reminders, fetchReminders } = useFetchReminders();
  const { stats, fetchStats } = useFetchAppointmentsStats();
  const { updateAppointment } = useUpdateAppointment();

  const [ viewMode, setViewMode ] = useState<ViewMode>("list");
  const [ filterStatus, setFilterStatus ] = useState<AppointmentStatus | "ALL">("ALL");
  const [ filterpaid, setFilterpaid ] = useState<"ALL" | "true" | "false">("ALL");
  const [ search, setSearch ] = useState("");
  const debouncedSearch = useDebounceState(search, 250);
  const [ dateFilter, setDateFilter ] = useState("");
  const [ page, setPage ] = useState(1);

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editAppt, setEditAppt ] = useState<Appointment | null>(null);
  const [ viewAppt, setViewAppt ] = useState<Appointment | null>(null);
  const [ deleteAppt, setDeleteAppt ] = useState<Appointment | null>(null);
  const [ prefillDate, setPrefillDate ] = useState<string | null>(null);

  const filters = useMemo<FetchAppointmentsFilters>(() => ({
    patientId: undefined,
    status: filterStatus !== "ALL" ? filterStatus : undefined,
    startAt: undefined,
    dateFrom: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
    dateTo: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
    search: debouncedSearch.trim() || undefined,
    paid: filterpaid !== "ALL" ? filterpaid === "true" : undefined,
    page: page,
    pageSize: PAGE_SIZE,
    orderBy: 'startAt',
    order: 'asc',
  }), [ filterStatus, filterpaid, debouncedSearch, dateFilter, page ]);

  const { appointments, loading, error, fetchAppointments, total, totalPages } = useFetchAppointments(filters);

  async function handlePay(id: string) {
    try {
      await updateAppointment(id, { paid: true });
    } finally { fetchStats(); fetchAppointments(); }
  }

  return (
    <>
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
              <button onClick={() => { setShowCreate(true); }} style={{
                ...btnPrimary, display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(30,58,95,0.3)", padding: "12px 24px",
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nueva Cita
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Total" value={stats?.total ?? 0} sub="todas las citas" accent="#1E3A5F" />
            <StatCard label="Hoy" value={stats?.todayCount ?? 0} sub="citas de hoy" accent="#3B82F6" />
            <StatCard label="Próximas" value={stats?.byStatus[ AppointmentStatus.SCHEDULED ] ?? 0} sub="sin confirmar" accent="#D97706" />
            <StatCard label="Sin pagar" value={stats?.unpaidCount ?? 0} sub="requieren cobro" accent="#DC2626" />
            <StatCard label="Ingresos" value={`$ ${stats?.paidRevenue.toLocaleString("es-ES") ?? 0}`} sub="total cobrado" accent="#16A34A" />
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
                <DateTimePicker date={dateFilter} onChanged={iso => setDateFilter(iso.slice(0, 10))} isFuture />
                {dateFilter && <button onClick={() => setDateFilter("")} style={{ ...btnSecondary, padding: "7px 12px", fontSize: 12 }}>✕ Fecha</button>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([
                    { k: "ALL", l: "Todas" },
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
                <select value={filterpaid} onChange={e => setFilterpaid(e.target.value as "true" | "false" | "ALL")} style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: 13 }}>
                  <option value="ALL">💳 Todas</option>
                  <option value="true">💳 Pagadas</option>
                  <option value="false">⏳ Sin pagar</option>
                </select>
              </div>
              <DataTable
                columns={[ "Paciente", "Tipo", "Fecha", "Recordatorio", "Ubicación", "Estado", "Pago", "" ]}
                rows={appointments}
                loading={loading}
                skeletonCount={6}
                renderRow={(a, i) => (
                  <tr key={a.id} style={{ borderBottom: i < appointments.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
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
                    <td style={{ ...tdStyle, fontSize: 13, color: "#111827", fontWeight: 500, whiteSpace: "nowrap" }}>{fmtDateAndTime(a.startAt)}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#000000" }}>{a.reminderId ? <ReminderStatusPill status={reminders.find(r => r.id === a.reminderId)?.status || ReminderStatus.FAILED} /> : <EmptyStatusPill label="Sin Recordatorio" />}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#6B7280", maxWidth: 130 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", backgroundColor: LOCATION_CFG[ a.location ]?.bg || "#F3F4F6", color: LOCATION_CFG[ a.location ]?.color || "#374151", padding: "4px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 12 }}>
                        {a.meetingUrl ? <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#2563EB", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>🔗 Virtual</a> : a.location}
                      </div>
                    </td>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><AppointmentStatusPill status={a.status} /></td>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <PayBadge paid={a.paid} />
                        {!a.paid && a.status !== AppointmentStatus.CANCELLED && (
                          <button onClick={() => handlePay(a.id)} style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, background: "#DCFCE7", border: "none", borderRadius: 6, color: "#16A34A", cursor: "pointer", opacity: 1 }}>
                            Pagó
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
                )}
                emptyState={<EmptyState icon="🔍" title="Sin resultados" sub="Prueba ajustando los filtros o crea una nueva cita." />}
                footer={
                  <>
                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                      Mostrando <strong style={{ color: "#374151" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> de <strong style={{ color: "#374151" }}>{total}</strong> pacientes
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {page !== 1 && <button onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: page === 1 ? "#F9FAFB" : "#fff", color: page === 1 ? "#D1D5DB" : "#374151", fontSize: 13, fontWeight: 500, cursor: page === 1 ? "default" : "pointer" }}>← Anterior</button>}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                        .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                          if (idx > 0 && n - (arr[ idx - 1 ] as number) > 1) acc.push("...");
                          acc.push(n);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "..." ? (
                            <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "#9CA3AF", padding: "0 4px" }}>…</span>
                          ) : (
                            <button key={item} onClick={() => setPage(item as number)} style={{ width: 32, height: 32, borderRadius: 7, border: "1.5px solid", borderColor: page === item ? "#1E3A5F" : "#E5E7EB", background: page === item ? "#1E3A5F" : "#fff", color: page === item ? "#fff" : "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{item}</button>
                          )
                        )
                      }
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: page === totalPages ? "#F9FAFB" : "#fff", color: page === totalPages ? "#D1D5DB" : "#374151", fontSize: 13, fontWeight: 500, cursor: page === totalPages ? "default" : "pointer" }}>Siguiente →</button>
                    </div>
                  </>
                }
              />
            </>
          )}
          {viewMode === "calendar" && (
            <div style={{ animation: "fadeIn 0.25s ease" }}>
              <CalendarView
                appointments={appointments}
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
          prefillDate={prefillDate}
          onClose={() => { setShowCreate(false); setPrefillDate(null); }}
          onSaved={() => { fetchAppointments(); fetchReminders(); fetchStats(); }}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          patients={patients}
          onClose={() => setEditAppt(null)}
          onSaved={() => { fetchAppointments(); fetchReminders(); fetchStats(); }}
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
          onCanceled={() => { fetchAppointments(); fetchReminders(); fetchStats() }}
        />
      )}
    </>
  );
}
