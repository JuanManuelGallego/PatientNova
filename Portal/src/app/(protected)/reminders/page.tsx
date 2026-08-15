"use client";
import { useMemo, useState, Suspense } from "react";
import {
  CHANNEL_CFG,
  FetchRemindersFilters,
  MAX_RETRIES,
  Reminder,
  ReminderStatus,
  REMINDER_STATUS_CONFIG,
} from "@/src/types/Reminder";
import { fmtDateTime, fmtRelative, todayString } from "@/src/utils/TimeUtils";
import { StatCard } from "@/src/components/Info/StatCard";
import { ReminderModal } from "@/src/components/Modals/ReminderModal";
import { EditScheduledReminderModal } from "@/src/components/Modals/EditScheduledReminderModal";
import { ReminderDrawer } from "@/src/components/Drawers/ReminderDrawer";
import { BulkSendWizard } from "@/src/components/Reminders/BulkSendWizard";
import { EmptyState } from "@/src/components/EmptyState";
import {
  DataTable,
  DataTableFooter,
  ColumnDef,
} from "@/src/components/DataTable";
import { TabNav } from "@/src/components/TabNav";
import { CancelReminderModal } from "@/src/components/Modals/CancelReminderModal";
import { useFetchReminders } from "@/src/api/reminders/useFetchReminders";
import { useFetchAllPatients } from "@/src/api/patients/useFetchAllPatients";
import { useRetryReminder } from "@/src/api/reminders/useRetryReminder";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { ReminderStatusPill } from "@/src/components/Info/StatusPill";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { FilterBar } from "@/src/components/FilterBar";
import { useFetchRemindersStats } from "@/src/api/reminders/useFetchRemindersStats";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { Megaphone, Send, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useListQueryState } from "@/src/hooks/useListQueryState";
import { withAllOption } from "@/src/utils/options";
import {
  PAGE_SIZE,
  QUERY_PARAMS,
  REMINDER_SORT,
  SORT_DIRECTION,
  type ReminderOrderBy,
} from "@/src/utils/listQuery";
import {
  useQueryState,
  parseAsString,
  parseAsStringEnum,
  parseAsArrayOf,
} from "nuqs";

enum ActiveTab {
  Active = "Active",
  History = "History",
  Bulk = "Bulk",
}

const STATUS_ACTIVE_OPTIONS = withAllOption(
  [ReminderStatus.PENDING, ReminderStatus.QUEUED],
  (v) => REMINDER_STATUS_CONFIG[v].label,
);

const STATUS_HISTORY_OPTIONS = withAllOption(
  [ReminderStatus.CANCELLED, ReminderStatus.FAILED, ReminderStatus.SENT],
  (v) => REMINDER_STATUS_CONFIG[v].label,
);

function RemindersPageContent() {
  const { stats, fetchStats } = useFetchRemindersStats();

  const [ activeTab, setActiveTab ] = useQueryState(
    QUERY_PARAMS.reminderTab,
    parseAsStringEnum(Object.values(ActiveTab)).withDefault(ActiveTab.Active),
  );
  const [ dateFilter, setDateFilter ] = useQueryState(
    QUERY_PARAMS.reminderDate,
    parseAsString.withDefault(""),
  );
  const [ statusFilter, setStatusFilter ] = useQueryState(
    QUERY_PARAMS.reminderStatus,
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  const {
    page,
    setPage,
    debouncedSearch,
    orderBy,
    setOrderBy,
    order,
    setOrder,
    handleSort,
    searchProps,
  } = useListQueryState<ReminderOrderBy>({
    orderByOptions: REMINDER_SORT.orderBy,
    orderByDefault: REMINDER_SORT.orderBy[0],
    sortable: REMINDER_SORT.sortable,
  });

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === ActiveTab.History) {
      setOrderBy(REMINDER_SORT.orderBy[3]);
      setOrder(SORT_DIRECTION.desc);
    } else if (tab === ActiveTab.Active) {
      setOrderBy(REMINDER_SORT.orderBy[0]);
      setOrder(SORT_DIRECTION.asc);
    }
  };

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editReminder, setEditReminder ] = useState<Reminder | null>(null);

  const [ viewReminder, setViewReminder ] = useState<Reminder | null>(null);
  const [ cancelReminder, setCancelReminder ] = useState<Reminder | null>(null);

  const filters = useMemo<FetchRemindersFilters>(
    () => {
      const tabDefault =
        activeTab === "Active"
          ? [ ReminderStatus.PENDING, ReminderStatus.QUEUED ]
          : activeTab === "History"
            ? [
              ReminderStatus.SENT,
              ReminderStatus.FAILED,
              ReminderStatus.CANCELLED,
            ]
            : undefined;
      return {
        status: statusFilter.length ? (statusFilter as ReminderStatus[]) : tabDefault,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        dateFrom: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
        dateTo: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
        orderBy: orderBy as FetchRemindersFilters["orderBy"],
        order,
      };
    },
    [ page, debouncedSearch, activeTab, statusFilter, dateFilter, orderBy, order ],
  );

  const { reminders, loading, error, fetchReminders, total, totalPages } =
    useFetchReminders(filters);

  const { retryReminder, loading: retryLoading } = useRetryReminder();

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Recordatorios"
          subtitle={todayString()}
          actions={
            <>
              <button
                onClick={() => {
                  fetchReminders();
                  fetchStats();
                }}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary btn-hero"
                data-testid="reminders-new-button"
              >
                Nuevo Recordatorio
              </button>
            </>
          }
        />
        <div className="stats-grid">
          <StatCard
            label="Activos"
            value={
              (stats?.byStatus[ ReminderStatus.PENDING ] || 0) +
              (stats?.byStatus[ ReminderStatus.QUEUED ] || 0)
            }
            sub="por enviar"
            accent="var(--c-link)"
            icon={Send}
          />
          <StatCard
            label="Enviados"
            value={stats?.byStatus[ ReminderStatus.SENT ] || 0}
            sub="entregados"
            accent="var(--c-success)"
            icon={Megaphone}
          />
          <StatCard
            label="Fallidos"
            value={stats?.byStatus[ ReminderStatus.FAILED ] || 0}
            sub="requieren atención"
            accent="var(--c-error)"
            icon={AlertTriangle}
          />
          <StatCard
            label="Cancelados"
            value={stats?.byStatus[ ReminderStatus.CANCELLED ] || 0}
            sub="fuera de la cola"
            accent="var(--c-gray-400)"
            icon={XCircle}
          />
        </div>
        <ReminderTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          stats={stats}
        />
        {activeTab !== "Bulk" && (
          <FilterBar
            {...searchProps}
            placeholder="Buscar por nombre, número, canal…"
            testId="reminders-search-input"
          />
        )}
        {error && activeTab !== "Bulk" && (
          <ErrorBanner
            msg={error}
            onRetry={() => {
              fetchReminders();
              fetchStats();
            }}
          />
        )}
        {activeTab === "Active" && (
          <ActiveRemindersTab
            reminders={reminders}
            loading={loading}
            page={page}
            total={total}
            totalPages={totalPages}
            setPage={setPage}
            setViewReminder={setViewReminder}
            setEditReminder={setEditReminder}
            setCancelReminder={setCancelReminder}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            orderBy={orderBy}
            order={order}
            onSort={handleSort}
          />
        )}
        {activeTab === "History" && (
          <HistoryRemindersTab
            reminders={reminders}
            loading={loading}
            page={page}
            total={total}
            totalPages={totalPages}
            setPage={setPage}
            setViewReminder={setViewReminder}
            onRetry={async (id) => {
              await retryReminder(id);
              fetchReminders();
              fetchStats();
            }}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            orderBy={orderBy}
            order={order}
            onSort={handleSort}
          />
        )}
        {activeTab === "Bulk" && <BulkTab />}
      </PageLayout>
      {showCreate && (
        <ReminderModal
          onClose={() => {
            setShowCreate(false);
            fetchReminders();
            fetchStats();
          }}
          onSaved={() => {
            fetchReminders();
            fetchStats();
          }}
        />
      )}
      {editReminder && (
        <EditScheduledReminderModal
          reminder={editReminder}
          onClose={() => setEditReminder(null)}
          onSaved={() => {
            fetchReminders();
            fetchStats();
          }}
        />
      )}
      {viewReminder && (
        <ReminderDrawer
          reminder={viewReminder}
          onClose={() => setViewReminder(null)}
          onEdit={() => {
            setEditReminder(viewReminder);
            setViewReminder(null);
          }}
          onCancel={() => {
            setCancelReminder(viewReminder);
            setViewReminder(null);
          }}
          onRetry={async () => {
            await retryReminder(viewReminder.id);
            setViewReminder(null);
            fetchReminders();
            fetchStats();
          }}
          retryLoading={retryLoading}
        />
      )}
      {cancelReminder && (
        <CancelReminderModal
          reminder={cancelReminder}
          onClose={() => setCancelReminder(null)}
          onCanceled={() => {
            setCancelReminder(null);
            fetchReminders();
            fetchStats();
          }}
        />
      )}
    </>
  );
}

function ActiveRemindersTab({
  reminders,
  loading,
  page,
  total,
  totalPages,
  setPage,
  setViewReminder,
  setEditReminder,
  setCancelReminder,
  statusFilter,
  setStatusFilter,
  dateFilter,
  setDateFilter,
  orderBy,
  order,
  onSort,
}: {
  reminders: Reminder[];
  loading: boolean;
  page: number;
  total: number;
  totalPages: number;
  setPage: (p: number) => void;
  setViewReminder: (r: Reminder) => void;
  setEditReminder: (r: Reminder) => void;
  setCancelReminder: (r: Reminder) => void;
  statusFilter: string[];
  setStatusFilter: (v: string[]) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  orderBy: string;
  order: "asc" | "desc";
  onSort: (sortKey: string) => void;
}) {
  const columns = useMemo<ColumnDef[]>(
    () => [
      { label: "Destinatario" },
      { label: "Canal" },
      {
        label: "Estado",
        sortKey: "status",
        filter: {
          kind: "enum",
          options: STATUS_ACTIVE_OPTIONS,
          value: statusFilter,
          onChange: (v: string[]) => {
            setStatusFilter(v);
            setPage(1);
          },
          testId: "reminder-status-filter",
          triggerTestId: "reminder-status-filter-trigger",
        },
      },
      {
        label: "Programado para",
        sortKey: "sendAt",
        filter: {
          kind: "date",
          value: dateFilter,
          onChange: (iso) => {
            setDateFilter(iso);
            setPage(1);
          },
          testId: "reminder-date-filter",
          triggerTestId: "reminder-date-filter-trigger",
        },
      },
      { label: "Dentro de" },
      { label: "Creado el" },
      { label: "" },
    ],
    [statusFilter, dateFilter, setStatusFilter, setDateFilter, setPage],
  );

  return (
    <DataTable
      columns={columns}
      rows={reminders}
      loading={loading}
      skeletonCount={4}
      testId="reminders-table"
      orderBy={orderBy}
      order={order}
      onSort={onSort}
      renderRow={(reminder) => (
        <tr
          key={reminder.id}
          className="table-row"
          onClick={() => setViewReminder(reminder)}
          data-testid={`reminder-row-${reminder.id}`}
        >
          <td className="td">
            <div className="td-name__primary">
              {reminder.patient?.name ?? "—"}{" "}
              {reminder.patient?.lastName ?? "—"}
            </div>
            <div className="td-name__secondary">{reminder.to}</div>
          </td>
          <td className="td td--date">{CHANNEL_CFG[ reminder.channel ].label}</td>
          <td className="td">
            <ReminderStatusPill status={reminder.status} />
          </td>
          <td className="td td--date">{fmtDateTime(reminder.sendAt)}</td>
          <td className="td td--date">{fmtRelative(reminder.sendAt)}</td>
          <td className="td td--subtle">{fmtDateTime(reminder.sendAt)}</td>
          <td className="td" onClick={(e) => e.stopPropagation()}>
            <div className="td-actions">
              <button
                onClick={() => setEditReminder(reminder)}
                className="btn-action-edit"
                data-testid={`reminder-reschedule-button-${reminder.id}`}
              >
                Reprogramar
              </button>
              <button
                onClick={() => setCancelReminder(reminder)}
                className="btn-action-delete"
                data-testid={`reminder-row-cancel-button-${reminder.id}`}
              >
                <ACTION_ICONS.close size={14} />
              </button>
            </div>
          </td>
        </tr>
      )}
      emptyState={
        <EmptyState
          icon={STATUS_ICONS.bell}
          title="Sin recordatorios activos"
          sub="Haz clic en Nuevo Recordatorio para programar el primero."
        />
      }
      footer={
        <DataTableFooter
          page={page}
          total={total}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          label="recordatorios"
          onPageChange={setPage}
        />
      }
    />
  );
}

function HistoryRemindersTab({
  reminders,
  loading,
  page,
  total,
  totalPages,
  setPage,
  setViewReminder,
  onRetry,
  statusFilter,
  setStatusFilter,
  dateFilter,
  setDateFilter,
  orderBy,
  order,
  onSort,
}: {
  reminders: Reminder[];
  loading: boolean;
  page: number;
  total: number;
  totalPages: number;
  setPage: (p: number) => void;
  setViewReminder: (r: Reminder) => void;
  onRetry: (id: string) => void;
  statusFilter: string[];
  setStatusFilter: (v: string[]) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  orderBy: string;
  order: "asc" | "desc";
  onSort: (sortKey: string) => void;
}) {
  const columns = useMemo<ColumnDef[]>(
    () => [
      { label: "Destinatario" },
      { label: "Canal" },
      {
        label: "Estado",
        sortKey: "status",
        filter: {
          kind: "enum",
          options: STATUS_HISTORY_OPTIONS,
          value: statusFilter,
          onChange: (v: string[]) => {
            setStatusFilter(v);
            setPage(1);
          },
          testId: "reminder-status-filter",
          triggerTestId: "reminder-status-filter-trigger",
        },
      },
      {
        label: "Programado para",
        sortKey: "sendAt",
        filter: {
          kind: "date",
          value: dateFilter,
          onChange: (iso) => {
            setDateFilter(iso);
            setPage(1);
          },
          testId: "reminder-date-filter",
          triggerTestId: "reminder-date-filter-trigger",
        },
      },
      {
        label: "Última actualización",
        sortKey: "updatedAt",
      },
      { label: "ID Mensaje" },
      { label: "Error" },
      { label: "" },
    ],
    [statusFilter, dateFilter, setStatusFilter, setDateFilter, setPage],
  );

  return (
    <DataTable
      columns={columns}
      rows={reminders}
      loading={loading}
      skeletonCount={5}
      testId="reminders-table"
      orderBy={orderBy}
      order={order}
      onSort={onSort}
      renderRow={(reminder) => (
        <tr
          key={reminder.id}
          className="table-row"
          onClick={() => setViewReminder(reminder)}
          data-testid={`reminder-row-${reminder.id}`}
        >
          <td className="td">
            <div className="td-name__primary">
              {reminder.patient?.name ?? "—"}{" "}
              {reminder.patient?.lastName ?? "—"}
            </div>
            <div className="td-name__secondary">{reminder.to}</div>
          </td>
          <td className="td td--date">{CHANNEL_CFG[ reminder.channel ].label}</td>
          <td className="td">
            <ReminderStatusPill status={reminder.status} />
          </td>
          <td className="td td--muted">{fmtDateTime(reminder.sendAt)}</td>
          <td className="td td--muted">{fmtDateTime(reminder.updatedAt)}</td>
          <td className="td td--mono">
            {reminder.messageId ? (
              <span title={reminder.messageId}>{reminder.messageId}</span>
            ) : (
              "—"
            )}
          </td>
          <td className="td td--error-cell">
            {reminder.error ? (
              <span className="td-error__text">{reminder.error}</span>
            ) : (
              <span className="td-error__empty">—</span>
            )}
          </td>
          <td className="td" onClick={(e) => e.stopPropagation()}>
            {reminder.status === ReminderStatus.FAILED && (
              <div className="td-actions">
                <button
                  onClick={() => onRetry(reminder.id)}
                  disabled={(reminder.retryCount ?? 0) > MAX_RETRIES}
                  title={(reminder.retryCount ?? 0) > MAX_RETRIES ? 'Máximo de reintentos alcanzado' : undefined}
                  className="btn-action-edit"
                  data-testid={`reminder-row-retry-button-${reminder.id}`}
                >
                  <ACTION_ICONS.retry size={14} />
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
      emptyState={
        <EmptyState
          icon={STATUS_ICONS.clipboard}
          title="Sin historial aún"
          sub="Los recordatorios enviados, fallidos y cancelados aparecerán aquí."
        />
      }
      footer={
        <DataTableFooter
          page={page}
          total={total}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          label="recordatorios"
          onPageChange={setPage}
        />
      }
    />
  );
}

function BulkTab() {
  const { patients, loading: loadingPatients } = useFetchAllPatients();
  return (
    <div className="bulk-section fade-in">
      <div className="info-banner">
        <span className="bulk-info__icon">
          <Megaphone size={20} />
        </span>
        <div>
          <div className="bulk-info__title">Envío Masivo</div>
          <div className="bulk-info__desc">
            Envía el mismo mensaje a múltiples pacientes a la vez. Solo se
            incluyen pacientes con estado <strong>Activo</strong> y número
            registrado para el canal seleccionado.
          </div>
        </div>
      </div>
      {loadingPatients ? (
        <div className="table-card" style={{ padding: 28 }}>
          <div className="patient-preview__detail">Cargando pacientes…</div>
        </div>
      ) : (
        <BulkSendWizard patients={patients} />
      )}
    </div>
  );
}

function ReminderTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  stats: ReturnType<typeof useFetchRemindersStats>[ "stats" ];
}) {
  return (
    <TabNav
      items={[
        { key: ActiveTab.Active, label: "Activos" },
        { key: ActiveTab.History, label: "Historial" },
        { key: ActiveTab.Bulk, label: "Envío Masivo" },
      ]}
      active={activeTab}
      onSelect={(key) => onTabChange(key as ActiveTab)}
      testIdPrefix="reminders-tab"
    />
  );
}

export default function RemindersPage() {
  return (
    <Suspense>
      <RemindersPageContent />
    </Suspense>
  );
}
