"use client";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import { PayStatusPill } from "@/src/components/Info/PayStatusPill";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { FilterBar } from "@/src/components/FilterBar";
import { DataTable, TableFooter } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { StatCard } from "@/src/components/Info/StatCard";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { CustomSelect } from "@/src/components/CustomSelect";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { Appointment, AppointmentStatus, DEFAULT_APPT_STATUS, FetchAppointmentsFilters } from "@/src/types/Appointment";
import { ReminderStatus } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { fmtDateTime, todayString } from "@/src/utils/TimeUtils";
import { useState, useMemo, Suspense } from "react";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { ReminderStatusPill, EmptyStatusPill, AppointmentStatusPill } from "@/src/components/Info/StatusPill";
import { useFetchAppointmentsStats } from "@/src/api/useFetchAppointmentsStats";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useDebounceState } from "@/src/utils/useDebounceState";
import { useQueryState, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';
import { AppointmentTypePill } from "@/src/components/Info/AppointmentTypePill";

const PAGE_SIZE = 10;

type FilterStatus = AppointmentStatus | "All" | "Upcoming";


function AppointmentsPageContent() {
  const { stats, fetchStats } = useFetchAppointmentsStats();
  const { updateAppointment } = useUpdateAppointment();

  const [ filterStatus, setFilterStatus ] = useQueryState("filterStatus", parseAsStringEnum<FilterStatus>([ "All", "Upcoming", ...Object.values(AppointmentStatus) ]).withDefault("Upcoming"));
  const [ filterpaid, setFilterpaid ] = useQueryState("filterpaid", parseAsStringEnum<"All" | "true" | "false">([ "All", "true", "false" ]).withDefault("All"));
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
    status: filterStatus === "Upcoming" ? DEFAULT_APPT_STATUS : filterStatus !== "All" ? filterStatus : undefined,
    startAt: undefined,
    dateFrom: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
    dateTo: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
    search: debouncedSearch.trim() || undefined,
    paid: filterpaid !== "All" ? filterpaid === "true" : undefined,
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

  async function handleConfirm(id: string) {
    try {
      await updateAppointment(id, { status: AppointmentStatus.CONFIRMED });
    } finally { fetchStats(); fetchAppointments(); }
  }

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Citas"
          subtitle={todayString()}
          actions={
            <button onClick={() => { setShowCreate(true); }} className="btn-primary btn-hero">
              <span className="btn-plus-icon">+</span> Nueva Cita
            </button>
          }
        />
        <div className="stats-grid stats-grid--5">
          <StatCard label="Total" value={stats?.total ?? 0} sub="todas las citas" accent="var(--c-brand)" />
          <StatCard label="Hoy" value={stats?.todayCount ?? 0} sub="citas de hoy" accent="var(--c-brand-accent)" />
          <StatCard label="Próximas" value={stats?.byStatus[ AppointmentStatus.SCHEDULED ] ?? 0} sub="sin confirmar" accent="var(--c-warning)" />
          <StatCard label="Sin pagar" value={stats?.unpaidCount ?? 0} sub="requieren cobro" accent="var(--c-error)" />
          <StatCard label="Ingresos" value={`$ ${stats?.paidRevenue.toLocaleString("es-ES") ?? 0}`} sub="total cobrado" accent="var(--c-success)" />
        </div>
        {error && <ErrorBanner msg={error} onRetry={fetchAppointments} />}
        <FilterBar
          value={search}
          onChange={v => setSearch(v)}
          onClear={() => { setSearch(""); setPage(1); }}
          placeholder="Buscar paciente, tipo, ubicación…"
          wrap
        >
          <DateTimePicker date={dateFilter} onChanged={iso => setDateFilter(iso.slice(0, 10))} isFuture />
          {dateFilter && <button onClick={() => setDateFilter("")} className="btn-secondary btn-secondary--sm">✕ Fecha</button>}
          <div className="filter-chips filter-chips--wrap">
            {([
              { k: "All", l: `Todas (${stats?.total ?? 0})` },
              { k: "Upcoming", l: `Próximas (${(stats?.byStatus[ AppointmentStatus.SCHEDULED ] ?? 0) + (stats?.byStatus[ AppointmentStatus.CONFIRMED ] ?? 0)})` },
              { k: AppointmentStatus.SCHEDULED, l: `Programadas (${stats?.byStatus[ AppointmentStatus.SCHEDULED ] ?? 0})` },
              { k: AppointmentStatus.CONFIRMED, l: `Confirmadas (${stats?.byStatus[ AppointmentStatus.CONFIRMED ] ?? 0})` },
              { k: AppointmentStatus.COMPLETED, l: `Completadas (${stats?.byStatus[ AppointmentStatus.COMPLETED ] ?? 0})` },
              { k: AppointmentStatus.CANCELLED, l: `Canceladas (${stats?.byStatus[ AppointmentStatus.CANCELLED ] ?? 0})` },
              { k: AppointmentStatus.NO_SHOW, l: `No asistió (${stats?.byStatus[ AppointmentStatus.NO_SHOW ] ?? 0})` },
            ] as const).map(({ k, l }) => (
              <button key={k} onClick={() => setFilterStatus(k)} className={`filter-chip ${filterStatus === k ? "filter-chip--active" : ""}`}>{l}</button>
            ))}
          </div>
          <CustomSelect
            value={filterpaid}
            className="form-input--auto"
            options={[
              { value: "All", label: "💳 Todas" },
              { value: "true", label: "💳 Pagadas" },
              { value: "false", label: "⏳ Sin pagar" },
            ]}
            onChange={(v) => setFilterpaid(v as "true" | "false" | "All")}
          />
        </FilterBar>
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
              <td className="td"><AppointmentTypePill appointmentType={a.appointmentType} /></td>
              <td className="td td--datetime">{fmtDateTime(a.startAt)}</td>
              <td className="td">{a.reminder ? <ReminderStatusPill status={a.reminder?.status || ReminderStatus.FAILED} /> : <EmptyStatusPill label="Sin Recordatorio" />}</td>
              <td className="td td--muted" style={{ maxWidth: 130 }}>
                <div className="location-badge" style={{ background: a.appointmentLocation.bg || "var(--c-gray-100)", color: a.appointmentLocation.color || "var(--c-gray-700)" }}>
                  {a.meetingUrl
                    ? <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="location-badge__link">🔗 Virtual</a>
                    : a.appointmentLocation.name}
                </div>
              </td>
              <td className="td" onClick={e => e.stopPropagation()}>
                <AppointmentStatusPill status={a.status} />
                {a.status === AppointmentStatus.SCHEDULED && (
                  <button onClick={() => handleConfirm(a.id)} className="btn-pay">Confirmó</button>
                )}
              </td>
              <td className="td" onClick={e => e.stopPropagation()}>
                <div className="td-actions">
                  <PayStatusPill paid={a.paid} />
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
      </PageLayout>
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
