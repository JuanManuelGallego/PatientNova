"use client";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import { PayBadge } from "@/src/components/Info/PayBadge";
import Sidebar from "@/src/components/Navigation/Sidebar";
import { DataTable, TableFooter } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { StatCard } from "@/src/components/Info/StatCard";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { Appointment, AppointmentStatus, FetchAppointmentsFilters, LOCATION_CFG } from "@/src/types/Appointment";
import { ReminderStatus } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { fmtDateAndTime } from "@/src/utils/TimeUtils";
import { useState, useMemo, Suspense } from "react";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { ReminderStatusPill, EmptyStatusPill, AppointmentStatusPill } from "@/src/components/Info/StatusPill";
import { useFetchAppointmentsStats } from "@/src/api/useFetchAppointmentsStats";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useDebounceState } from "@/src/utils/useDebounceState";
import { useQueryState, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';

const PAGE_SIZE = 10;

function AppointmentsPageContent() {
  const { stats, fetchStats } = useFetchAppointmentsStats();
  const { updateAppointment } = useUpdateAppointment();

  const [ filterStatus, setFilterStatus ] = useQueryState("filterStatus", parseAsStringEnum<AppointmentStatus | "ALL">([ "ALL", AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW ]).withDefault("ALL"));
  const [ filterpaid, setFilterpaid ] = useQueryState("filterpaid", parseAsStringEnum<"ALL" | "true" | "false">([ "ALL", "true", "false" ]).withDefault("ALL"));
  const [ dateFilter, setDateFilter ] = useQueryState("dateFilter", parseAsString.withDefault(""));
  const [ page, setPage ] = useQueryState("page", parseAsInteger.withDefault(1));
  const [ search, setSearch ] = useQueryState("search", parseAsString.withDefault(""));
  const debouncedSearch = useDebounceState(search, 250);

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
      <div className="page-shell">
        <Sidebar />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">Citas</h1>
              <p className="page-subtitle">
                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="page-header__actions">
              <button onClick={() => { setShowCreate(true); }} className="btn-primary btn-hero">
                <span className="btn-plus-icon">+</span> Nueva Cita
              </button>
            </div>
          </div>
          <div className="stats-grid stats-grid--5">
            <StatCard label="Total" value={stats?.total ?? 0} sub="todas las citas" accent="var(--c-brand)" />
            <StatCard label="Hoy" value={stats?.todayCount ?? 0} sub="citas de hoy" accent="var(--c-brand-accent)" />
            <StatCard label="Próximas" value={stats?.byStatus[ AppointmentStatus.SCHEDULED ] ?? 0} sub="sin confirmar" accent="var(--c-warning)" />
            <StatCard label="Sin pagar" value={stats?.unpaidCount ?? 0} sub="requieren cobro" accent="var(--c-error)" />
            <StatCard label="Ingresos" value={`$ ${stats?.paidRevenue.toLocaleString("es-ES") ?? 0}`} sub="total cobrado" accent="var(--c-success)" />
          </div>
          {error && <ErrorBanner msg={error} onRetry={fetchAppointments} />}
          <div className="filter-bar filter-bar--wrap">
            <div className="search-wrapper">
              <input placeholder="Buscar paciente, tipo, ubicación…" value={search} onChange={e => setSearch(e.target.value)} className="form-input" />
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="search-clear-btn"
                aria-label="Limpiar búsqueda"
              >✕</button>
            </div>
            <DateTimePicker date={dateFilter} onChanged={iso => setDateFilter(iso.slice(0, 10))} isFuture />
            {dateFilter && <button onClick={() => setDateFilter("")} className="btn-secondary btn-secondary--sm">✕ Fecha</button>}
            <div className="filter-chips filter-chips--wrap">
              {([
                { k: "ALL", l: "Todas" },
                { k: AppointmentStatus.SCHEDULED, l: "Programadas" },
                { k: AppointmentStatus.CONFIRMED, l: "Confirmadas" },
                { k: AppointmentStatus.COMPLETED, l: "Completadas" },
                { k: AppointmentStatus.CANCELLED, l: "Canceladas" },
                { k: AppointmentStatus.NO_SHOW, l: "No asistió" },
              ] as const).map(({ k, l }) => (
                <button key={k} onClick={() => setFilterStatus(k)} className={`filter-chip ${filterStatus === k ? "filter-chip--active" : ""}`}>{l}</button>
              ))}
            </div>
            <select value={filterpaid} onChange={e => setFilterpaid(e.target.value as "true" | "false" | "ALL")} className="form-input form-input--auto">
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
            renderRow={(a) => (
              <tr key={a.id} className="table-row" onClick={() => setViewAppt(a)}>
                <td className="td">
                  <div className="td-identity">
                    <div className="avatar avatar--sm" style={{ background: getAvatarColor(a.patient.id) }}>
                      {getInitials(a.patient.name, a.patient.lastName)}
                    </div>
                    <div>
                      <div className="td-name__primary">{a.patient.name} {a.patient.lastName}</div>
                      <div className="td-name__secondary">{a.patient.email}</div>
                    </div>
                  </div>
                </td>
                <td className="td td--date" style={{ maxWidth: 140 }}>
                  <div className="text-ellipsis">{a.type}</div>
                </td>
                <td className="td td--datetime">{fmtDateAndTime(a.startAt)}</td>
                <td className="td">{a.reminder ? <ReminderStatusPill status={a.reminder?.status || ReminderStatus.FAILED} /> : <EmptyStatusPill label="Sin Recordatorio" />}</td>
                <td className="td td--muted" style={{ maxWidth: 130 }}>
                  <div className="location-badge" style={{ background: LOCATION_CFG[ a.location ]?.bg || "var(--c-gray-100)", color: LOCATION_CFG[ a.location ]?.color || "var(--c-gray-700)" }}>
                    {a.meetingUrl
                      ? <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="location-badge__link">🔗 Virtual</a>
                      : a.location}
                  </div>
                </td>
                <td className="td" onClick={e => e.stopPropagation()}><AppointmentStatusPill status={a.status} /></td>
                <td className="td" onClick={e => e.stopPropagation()}>
                  <div className="td-actions">
                    <PayBadge paid={a.paid} />
                    {!a.paid && a.status !== AppointmentStatus.CANCELLED && (
                      <button onClick={() => handlePay(a.id)} className="btn-pay">Pagó</button>
                    )}
                  </div>
                </td>
                <td className="td" onClick={e => e.stopPropagation()}>
                  <div className="td-actions">
                    <button onClick={() => setEditAppt(a)} className="btn-action-edit">Editar</button>
                    <button onClick={() => setDeleteAppt(a)} className="btn-action-delete">✕</button>
                  </div>
                </td>
              </tr>
            )}
            emptyState={<EmptyState icon="🔍" title="Sin resultados" sub="Prueba ajustando los filtros o crea una nueva cita." />}
            footer={<TableFooter page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} label="citas" onPageChange={setPage} />}
          />
        </main>
      </div>
      {showCreate && (
        <AppointmentModal
          appt={undefined}
          prefillDate={prefillDate}
          onClose={() => { setShowCreate(false); setPrefillDate(null); }}
          onSaved={() => { fetchAppointments(); fetchStats(); }}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={() => { fetchAppointments(); fetchStats(); }}
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
          onCanceled={() => { fetchAppointments(); fetchStats() }}
        />
      )}
    </>
  );
}

export default function AppointmentsPage() {
  return <Suspense><AppointmentsPageContent /></Suspense>;
}
