"use client";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import { PayStatusPill } from "@/src/components/Info/PayStatusPill";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { FilterBar } from "@/src/components/FilterBar";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import {
  ExternalLink,
  CalendarCheck,
  Clock,
  AlertCircle,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { DataTable, TableFooter, ColumnDef } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { StatCard } from "@/src/components/Info/StatCard";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import {
  Appointment,
  AppointmentStatus,
  APPT_STATUS_CFG,
  DEFAULT_APPT_STATUS,
  HISTORY_APPT_STATUS,
  FetchAppointmentsFilters,
} from "@/src/types/Appointment";
import { ReminderStatus } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { fmtDateTime, todayString } from "@/src/utils/TimeUtils";
import { useState, useMemo, Suspense } from "react";
import { useFetchAppointments } from "@/src/api/appointments/useFetchAppointments";
import {
  ReminderStatusPill,
  EmptyStatusPill,
  AppointmentStatusPill,
} from "@/src/components/Info/StatusPill";
import { useFetchAppointmentsStats } from "@/src/api/appointments/useFetchAppointmentsStats";
import { useUpdateAppointment } from "@/src/api/appointments/useUpdateAppointment";
import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import { useFetchLocations } from "@/src/api/locations/useFetchLocations";
import { useDebounceState } from "@/src/hooks/useDebounceState";
import { useSortHandler } from "@/src/hooks/useSortHandler";
import {
  useQueryState,
  parseAsInteger,
  parseAsString,
  parseAsArrayOf,
  parseAsStringEnum,
} from "nuqs";
import { AppointmentTypePill } from "@/src/components/Info/AppointmentTypePill";

const PAGE_SIZE = 10;

enum AppointmentTab {
  Upcoming = "upcoming",
  History = "history",
}

const APPT_SORT = {
  orderBy: [
    "startAt",
    "status",
    "price",
    "createdAt",
  ] as const,
  sortable: [
    "startAt",
    "status",
    "price",
  ] as const,
} as const;

type ApptOrderBy = (typeof APPT_SORT.orderBy)[number];

const tabStatuses = (tab: AppointmentTab): AppointmentStatus[] =>
  tab === AppointmentTab.Upcoming ? DEFAULT_APPT_STATUS : HISTORY_APPT_STATUS;

const STATUS_OPTIONS = (tab: AppointmentTab) => [
  { value: "", label: "Todos" },
  ...tabStatuses(tab).map((v) => ({
    value: v,
    label: APPT_STATUS_CFG[v].label,
  })),
];

const PAID_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "true", label: "Pagadas" },
  { value: "false", label: "Sin pagar" },
];

const TYPE_OPTIONS = (types: { id: string; name: string }[]) => [
  { value: "", label: "Todos" },
  ...types.map((t) => ({ value: t.id, label: t.name })),
];

const LOCATION_OPTIONS = (locations: { id: string; name: string }[]) => [
  { value: "", label: "Todos" },
  ...locations.map((l) => ({ value: l.id, label: l.name })),
];

function AppointmentsPageContent() {
  const { stats, fetchStats } = useFetchAppointmentsStats();
  const { updateAppointment } = useUpdateAppointment();
  const { appointmentTypes } = useFetchAppointmentTypes();
  const { locations } = useFetchLocations();

  const [ status, setStatus ] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [ activeTab, setActiveTab ] = useQueryState(
    "tab",
    parseAsStringEnum(Object.values(AppointmentTab)).withDefault(AppointmentTab.Upcoming),
  );
  const [ paid, setPaid ] = useQueryState(
    "paid",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [ typeId, setTypeId ] = useQueryState(
    "typeId",
    parseAsString.withDefault(""),
  );
  const [ locationId, setLocationId ] = useQueryState(
    "locationId",
    parseAsString.withDefault(""),
  );
  const [ dateFilter, setDateFilter ] = useQueryState(
    "dateFilter",
    parseAsString.withDefault(""),
  );
  const [ page, setPage ] = useQueryState("page", parseAsInteger.withDefault(1));
  const [ search, setSearch ] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const debouncedSearch = useDebounceState(search, 250);
  const [ orderBy, setOrderBy ] = useQueryState(
    "orderBy",
    parseAsStringEnum([...APPT_SORT.orderBy]).withDefault("startAt"),
  );
  const [ order, setOrder ] = useQueryState(
    "order",
    parseAsStringEnum(["asc", "desc"]).withDefault("asc"),
  );

  const handleSort = useSortHandler<ApptOrderBy>(
    APPT_SORT.sortable,
    orderBy,
    setOrderBy,
    order,
    setOrder,
    setPage,
  );

  const handleTabChange = (tab: AppointmentTab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === AppointmentTab.History) {
      setOrderBy("startAt");
      setOrder("desc");
    } else {
      setOrderBy("startAt");
      setOrder("asc");
    }
  };

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editAppt, setEditAppt ] = useState<Appointment | null>(null);
  const [ viewAppt, setViewAppt ] = useState<Appointment | null>(null);
  const [ deleteAppt, setDeleteAppt ] = useState<Appointment | null>(null);
  const [ prefillDate, setPrefillDate ] = useState<string | null>(null);

  const filters = useMemo<FetchAppointmentsFilters>(
    () => {
      const tabDefault = tabStatuses(activeTab);
      return {
        patientId: undefined,
        status: status.length ? (status as AppointmentStatus[]) : tabDefault,
        startAt: undefined,
        dateFrom: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
        dateTo: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
        search: debouncedSearch.trim() || undefined,
        paid: paid.length ? paid[0] === "true" : undefined,
        typeId: typeId || undefined,
        locationId: locationId || undefined,
        page: page,
        pageSize: PAGE_SIZE,
        orderBy: orderBy as FetchAppointmentsFilters["orderBy"],
        order: order as "asc" | "desc",
      };
    },
    [ status, paid, debouncedSearch, dateFilter, typeId, locationId, activeTab, page, orderBy, order ],
  );

  const columns = useMemo<ColumnDef[]>(
    () => [
      { label: "Paciente" },
      {
        label: "Estado",
        sortKey: "status",
        filter: {
          kind: "enum",
          options: STATUS_OPTIONS(activeTab),
          value: status,
          onChange: (v: string[]) => {
            setStatus(v);
            setPage(1);
          },
          testId: "appointment-status-filter",
          triggerTestId: "appointment-status-filter-trigger",
        },
      },
      {
        label: "Tipo",
        filter: {
          kind: "single-enum",
          options: TYPE_OPTIONS(appointmentTypes),
          value: typeId,
          onChange: (v: string) => {
            setTypeId(v);
            setPage(1);
          },
          testId: "appointment-type-filter",
          triggerTestId: "appointment-type-filter-trigger",
        },
      },
      {
        label: "Fecha y Hora",
        sortKey: "startAt",
        filter: {
          kind: "date",
          value: dateFilter,
          onChange: (iso) => {
            setDateFilter(iso);
            setPage(1);
          },
          testId: "appointment-date-filter",
          triggerTestId: "appointment-date-filter-trigger",
        },
      },
      { label: "Recordatorio" },
      {
        label: "Ubicación",
        filter: {
          kind: "single-enum",
          options: LOCATION_OPTIONS(locations),
          value: locationId,
          onChange: (v: string) => {
            setLocationId(v);
            setPage(1);
          },
          testId: "appointment-location-filter",
          triggerTestId: "appointment-location-filter-trigger",
        },
      },
      {
        label: "Pago",
        sortKey: "price",
        filter: {
          kind: "enum",
          options: PAID_OPTIONS,
          value: paid,
          onChange: (v: string[]) => {
            setPaid(v);
            setPage(1);
          },
          testId: "appointment-paid-filter",
          triggerTestId: "appointment-paid-filter-trigger",
        },
      },
      { label: "" },
    ],
    [status, paid, dateFilter, typeId, locationId, activeTab, appointmentTypes, locations, setStatus, setPaid, setDateFilter, setTypeId, setLocationId, setPage],
  );

  const { appointments, loading, error, fetchAppointments, total, totalPages } =
    useFetchAppointments(filters);

  const [ actionError, setActionError ] = useState<string | null>(null);

  async function handlePay(id: string) {
    setActionError(null);
    try {
      await updateAppointment(id, { paid: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al registrar el pago");
    } finally {
      fetchStats();
      fetchAppointments();
    }
  }

  async function handleConfirm(id: string) {
    setActionError(null);
    try {
      await updateAppointment(id, { status: AppointmentStatus.CONFIRMED });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al confirmar la cita");
    } finally {
      fetchStats();
      fetchAppointments();
    }
  }

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Citas"
          subtitle={todayString()}
          actions={
            <>
              <button
                onClick={() => {
                  fetchAppointments();
                  fetchStats();
                }}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => {
                  setShowCreate(true);
                }}
                className="btn-primary btn-hero"
                data-testid="appointments-new-button"
              >
                Nueva Cita
              </button>
            </>
          }
        />
        <div className="stats-grid stats-grid--5">
          <StatCard
            label="Hoy"
            value={stats?.todayCount ?? 0}
            sub="citas de hoy"
            accent="var(--c-brand-accent)"
            icon={CalendarCheck}
          />
          <StatCard
            label="Próximas"
            value={stats?.byStatus[ AppointmentStatus.SCHEDULED ] ?? 0}
            sub="sin confirmar"
            accent="var(--c-warning)"
            icon={Clock}
          />
          <StatCard
            label="Sin pagar"
            value={stats?.unpaidCount ?? 0}
            sub="requieren cobro"
            accent="var(--c-error)"
            icon={AlertCircle}
          />
          <StatCard
            label="Ingresos del mes"
            value={`$ ${stats?.paidRevenueThisMonth.toLocaleString("es-ES") ?? 0}`}
            sub="total cobrado"
            accent="var(--c-success)"
            icon={DollarSign}
          />
        </div>
        <AppointmentsTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        {error && <ErrorBanner msg={error} onRetry={fetchAppointments} />}
        {actionError && (
          <ErrorBanner msg={actionError} onRetry={() => setActionError(null)} />
        )}
        <FilterBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          onClear={() => {
            setSearch("");
            setPage(1);
          }}
          placeholder="Buscar paciente, tipo, ubicación…"
          testId="appointments-search-input"
        />
        <DataTable
          columns={columns}
          rows={appointments}
          loading={loading}
          skeletonCount={6}
          testId="appointments-table"
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          total={total}
          renderRow={(a) => (
            <tr key={a.id} className="table-row" onClick={() => setViewAppt(a)} data-testid={`appointment-row-${a.id}`}>
              <td className="td">
                <div className="td-identity">
                  <div
                    className="avatar avatar--sm"
                    style={{ background: getAvatarColor(a.patient.id) }}
                  >
                    {getInitials(a.patient.name, a.patient.lastName)}
                  </div>
                  <div>
                    <div className="td-name__primary">
                      {a.patient.name} {a.patient.lastName}
                    </div>
                    <div className="td-name__secondary">{a.patient.email}</div>
                  </div>
                </div>
              </td>
              <td className="td" onClick={(e) => e.stopPropagation()}>
                <AppointmentStatusPill status={a.status} />
                {a.status === AppointmentStatus.SCHEDULED && (
                    <button
                      onClick={() => handleConfirm(a.id)}
                      className="btn-pay"
                      data-testid={`appointment-confirm-button-${a.id}`}
                    >
                      Confirmó
                    </button>
                )}
              </td>
              <td className="td">
                <AppointmentTypePill appointmentType={a.appointmentType} />
              </td>
              <td className="td td--datetime">{fmtDateTime(a.startAt)}</td>
              <td className="td">
                {a.reminder ? (
                  <ReminderStatusPill
                    status={a.reminder?.status || ReminderStatus.FAILED}
                  />
                ) : (
                  <EmptyStatusPill label="Sin Recordatorio" />
                )}
              </td>
              <td className="td td--muted" style={{ maxWidth: 130 }}>
                <div
                  className="location-badge"
                  style={{
                    background: a.appointmentLocation.color + "15" || "var(--c-gray-100)",
                    color: a.appointmentLocation.color || "var(--c-gray-700)",
                  }}
                >
                  {a.meetingUrl ? (
                    <a
                      href={a.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="location-badge__link"
                      data-testid={`appointment-table-virtual-link-${a.id}`}
                    >
                      <ExternalLink size={12} /> Virtual
                    </a>
                  ) : (
                    a.appointmentLocation.name
                  )}
                </div>
              </td>
              <td className="td" onClick={(e) => e.stopPropagation()}>
                <div className="td-actions">
                  {a.status !== AppointmentStatus.CANCELLED && (
                    <>
                      <PayStatusPill paid={a.paid} />
                      {!a.paid && (
                        <button onClick={() => handlePay(a.id)} className="btn-pay" data-testid={`appointment-pay-button-${a.id}`}>
                          Pagó
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
              <td className="td" onClick={(e) => e.stopPropagation()}>
                  <div className="td-actions">
                    <button
                      onClick={() => setEditAppt(a)}
                      className="btn-action-edit"
                      data-testid={`appointment-edit-button-${a.id}`}
                      >
                      Editar
                    </button>
                    {(a.status == AppointmentStatus.CONFIRMED || a.status == AppointmentStatus.SCHEDULED) &&
                    (<button
                        onClick={() => setDeleteAppt(a)}
                        className="btn-action-delete"
                        data-testid={`appointment-delete-button-${a.id}`}
                      >
                        <ACTION_ICONS.close size={14} />
                      </button>
                    )}
                  </div>
              </td>
            </tr>
          )}
          emptyState={
            <EmptyState
              icon={STATUS_ICONS.search}
              title="Sin resultados"
              sub="Prueba ajustando los filtros o crea una nueva cita."
            />
          }
          footer={
            <TableFooter
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              totalPages={totalPages}
              label="citas"
              onPageChange={setPage}
              testIdPrefix="appointments-pagination"
            />
          }
        />
      </PageLayout>
      {showCreate && (
        <AppointmentModal
          appt={undefined}
          prefillDate={prefillDate}
          onClose={() => {
            setShowCreate(false);
            setPrefillDate(null);
          }}
          onSaved={() => {
            fetchAppointments();
            fetchStats();
          }}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={() => {
            fetchAppointments();
            fetchStats();
          }}
        />
      )}
      {viewAppt && !editAppt && !deleteAppt && (
        <AppointmentDrawer
          appt={viewAppt}
          onClose={() => setViewAppt(null)}
          onEdit={() => {
            setEditAppt(viewAppt);
            setViewAppt(null);
          }}
          onPay={() => {
            handlePay(viewAppt.id);
            setViewAppt(null);
          }}
          onDelete={() => {
            setDeleteAppt(viewAppt);
            setViewAppt(null);
          }}
        />
      )}
      {deleteAppt && (
        <CancelAppointmentModal
          appt={deleteAppt}
          onClose={() => setDeleteAppt(null)}
          onCanceled={() => {
            fetchAppointments();
            fetchStats();
          }}
        />
      )}
    </>
  );
}

function AppointmentsTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: AppointmentTab;
  onTabChange: (tab: AppointmentTab) => void;
}) {
  const tabs = [
    { key: AppointmentTab.Upcoming, label: "Próximas" },
    { key: AppointmentTab.History, label: "Historial" },
  ];

  return (
    <div className="tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`filter-chip ${activeTab === tab.key ? "filter-chip--active" : ""}`}
          data-testid={`appointments-tab-${tab.key}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsPageContent />
    </Suspense>
  );
}
