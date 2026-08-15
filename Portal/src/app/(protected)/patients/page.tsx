"use client";
import { useState, useMemo, Suspense } from "react";
import {
  useQueryState,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import {
  FetchPatientsFilters,
  Patient,
  PatientStatus,
} from "@/src/types/Patient";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { StatCard } from "@/src/components/Info/StatCard";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { ChannelPill } from "@/src/components/Info/ChannelPill";
import { DataTable, TableFooter, ColumnDef } from "@/src/components/DataTable";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { DeletePatientModal } from "@/src/components/Modals/DeletePatientModal";
import { Channel } from "@/src/types/Reminder";
import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
import { PatientDrawer } from "@/src/components/Drawers/PatientDrawer";
import { PatientStatusPill } from "@/src/components/Info/StatusPill";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { Users, UserCheck, UserX, RefreshCw } from "lucide-react";
import { EmptyState } from "@/src/components/EmptyState";
import { useDebounceState } from "@/src/hooks/useDebounceState";
import { useFetchPatientsStats } from "@/src/api/patients/useFetchPatientsStats";
import { FilterBar } from "@/src/components/FilterBar";
import { todayString } from "@/src/utils/TimeUtils";

const PAGE_SIZE = 10;

enum PatientTab {
  Active = "active",
  Inactive = "inactive",
}

const PATIENT_ORDER_BY = [
  "name",
  "email",
  "createdAt",
] as const;

const PATIENT_SORTABLE_COLUMNS = [
  "name",
  "email",
  "createdAt",
] as const;

function PatientsPageContent() {
  const { stats, fetchStats } = useFetchPatientsStats();

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum(Object.values(PatientTab)).withDefault(PatientTab.Active),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const debouncedSearch = useDebounceState(search, 250);
  const [orderBy, setOrderBy] = useQueryState(
    "orderBy",
    parseAsStringEnum([...PATIENT_ORDER_BY]).withDefault("name"),
  );
  const [order, setOrder] = useQueryState(
    "order",
    parseAsStringEnum(["asc", "desc"]).withDefault("asc"),
  );

  const handleSort = (sortKey: string) => {
    if (!(PATIENT_SORTABLE_COLUMNS as readonly string[]).includes(sortKey)) return;
    if (orderBy === sortKey) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(sortKey as typeof orderBy);
      setOrder("asc");
    }
    setPage(1);
  };

  const handleTabChange = (tab: PatientTab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === PatientTab.Inactive) {
      setOrderBy("createdAt");
      setOrder("desc");
    } else {
      setOrderBy("name");
      setOrder("asc");
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);

  const filters = useMemo<FetchPatientsFilters>(
    () => {
      const tabDefault =
        activeTab === PatientTab.Active
          ? [PatientStatus.ACTIVE]
          : [PatientStatus.INACTIVE];
      return {
        search: debouncedSearch,
        status: tabDefault,
        page,
        pageSize: PAGE_SIZE,
        orderBy: orderBy as FetchPatientsFilters["orderBy"],
        order: order as "asc" | "desc",
      };
    },
    [debouncedSearch, activeTab, page, orderBy, order],
  );

  const { patients, loading, error, fetchPatients, total, totalPages } =
    useFetchPatients(filters);

  const columns = useMemo<ColumnDef[]>(
    () => [
      {
        label: "Paciente",
        sortKey: "name",
      },
      { label: "Correo" },
      { label: "WhatsApp" },
      { label: "SMS" },
      {
        label: "Estado",
      },
      {
        label: "Registrado",
        sortKey: "createdAt",
      },
      { label: "" },
    ],
    [],
  );

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Pacientes"
          subtitle={todayString()}
          actions={
            <>
              <button
                onClick={() => {
                  fetchPatients();
                  fetchStats();
                }}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary btn-hero"
                data-testid="patients-new-button"
              >
                Nuevo Paciente
              </button>
            </>
          }
        />
        <div className="stats-grid">
          <StatCard
            label="Total Pacientes"
            value={stats?.total ?? 0}
            sub="en el sistema"
            accent="var(--c-brand)"
            icon={Users}
          />
          <StatCard
            label="Activos"
            value={stats?.byStatus[PatientStatus.ACTIVE] ?? 0}
            sub="reciben notificaciones"
            accent="var(--c-success)"
            icon={UserCheck}
          />
          <StatCard
            label="Inactivos"
            value={stats?.byStatus[PatientStatus.INACTIVE] ?? 0}
            sub="sin notificaciones"
            accent="var(--c-warning)"
            icon={UserX}
          />
        </div>
        <PatientsTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        <FilterBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onClear={() => {
            setSearch("");
            setPage(1);
          }}
          placeholder="Buscar por nombre, apellido o correo…"
        />
        {error && <ErrorBanner msg={error} onRetry={fetchPatients} />}
        <DataTable
          columns={columns}
          rows={patients}
          loading={loading}
          skeletonCount={5}
          testId="patients-table"
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          total={total}
          renderRow={(p) => (
            <tr
              onClick={() => setViewPatient(p)}
              key={p.id}
              className="table-row"
              data-testid={`patient-row-${p.id}`}
            >
              <td className="td">
                <div className="td-identity">
                  <div
                    className="avatar avatar--md"
                    style={{ background: getAvatarColor(p.id) }}
                  >
                    {getInitials(p.name, p.lastName)}
                  </div>
                  <div className="td-name__primary">
                    {p.name} {p.lastName}
                  </div>
                </div>
              </td>
              <td className="td td--date">
                {p.email ? (
                  <a href={`mailto:${p.email}`} className="td-email-link">
                    {p.email}
                  </a>
                ) : (
                  <span className="td-email-empty">
                    <span className="td-email-empty__dash">—</span>
                  </span>
                )}
              </td>
              <td className="td">
                <ChannelPill type={Channel.WHATSAPP} value={p.whatsappNumber} />
              </td>
              <td className="td">
                <ChannelPill type={Channel.SMS} value={p.smsNumber} />
              </td>
              <td className="td">
                <PatientStatusPill status={p.status} />
              </td>
              <td className="td td--muted td--nowrap">
                {new Date(p.createdAt).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="td" onClick={(e) => e.stopPropagation()}>
                <div className="td-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditPatient(p);
                    }}
                    className="btn-action-edit"
                    data-testid={`patient-edit-button-${p.id}`}
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePatient(p);
                    }}
                    className="btn-action-delete"
                    data-testid={`patient-delete-button-${p.id}`}
                  >
                    <ACTION_ICONS.close size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )}
          emptyState={
            <EmptyState
              icon={STATUS_ICONS.search}
              title={
                search
                  ? "Sin resultados"
                  : "No hay pacientes aún"
              }
              sub={
                search
                  ? "Prueba ajustando los filtros de búsqueda."
                  : 'Haz clic en "Nuevo Paciente" para agregar el primero.'
              }
            />
          }
          footer={
            <TableFooter
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              totalPages={totalPages}
              label="pacientes"
              onPageChange={setPage}
            />
          }
        />
      </PageLayout>
      {showCreate && (
        <PatientModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            fetchPatients();
            fetchStats();
          }}
        />
      )}
      {editPatient && (
        <PatientModal
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSaved={() => {
            fetchPatients();
            fetchStats();
          }}
        />
      )}
      {deletePatient && (
        <DeletePatientModal
          patient={deletePatient}
          onClose={() => setDeletePatient(null)}
          onDeleted={() => {
            fetchPatients();
            fetchStats();
          }}
        />
      )}
      {viewPatient && (
        <PatientDrawer
          patient={viewPatient}
          onClose={() => setViewPatient(null)}
          onDelete={() => {
            setDeletePatient(viewPatient);
            setViewPatient(null);
          }}
          onEdit={() => {
            setEditPatient(viewPatient);
            setViewPatient(null);
          }}
        />
      )}
    </>
  );
}

function PatientsTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: PatientTab;
  onTabChange: (tab: PatientTab) => void;
}) {
  const tabs = [
    { key: PatientTab.Active, label: "Activos" },
    { key: PatientTab.Inactive, label: "Inactivos" },
  ];

  return (
    <div className="tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`filter-chip ${activeTab === tab.key ? "filter-chip--active" : ""}`}
          data-testid={`patients-tab-${tab.key}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsPageContent />
    </Suspense>
  );
}
