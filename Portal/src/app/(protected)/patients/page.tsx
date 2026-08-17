"use client";
import { useState, useMemo, Suspense } from "react";
import { useQueryState, parseAsStringEnum } from "nuqs";

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
import {
  DataTable,
  DataTableFooter,
  ColumnDef,
} from "@/src/components/DataTable";
import { TabNav } from "@/src/components/TabNav";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { TogglePatientModal } from "@/src/components/Modals/TogglePatientModal";
import { Channel } from "@/src/types/Reminder";
import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
import { PatientDrawer } from "@/src/components/Drawers/PatientDrawer";
import { PatientStatusPill } from "@/src/components/Info/StatusPill";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { Users, UserCheck, UserX, RefreshCw } from "lucide-react";
import { EmptyState } from "@/src/components/EmptyState";
import { useFetchPatientsStats } from "@/src/api/patients/useFetchPatientsStats";
import { FilterBar } from "@/src/components/FilterBar";
import { todayString } from "@/src/utils/TimeUtils";
import { useListQueryState } from "@/src/hooks/useListQueryState";
import {
  PAGE_SIZE,
  QUERY_PARAMS,
  PATIENT_SORT,
  SORT_DIRECTION,
  type PatientOrderBy,
} from "@/src/utils/listQuery";

enum PatientTab {
  Active = "active",
  Inactive = "inactive",
}

function PatientsPageContent() {
  const { stats, fetchStats } = useFetchPatientsStats();

  const [activeTab, setActiveTab] = useQueryState(
    QUERY_PARAMS.patientTab,
    parseAsStringEnum(Object.values(PatientTab)).withDefault(PatientTab.Active),
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
  } = useListQueryState<PatientOrderBy>({
    orderByOptions: PATIENT_SORT.orderBy,
    orderByDefault: PATIENT_SORT.orderBy[0],
    sortable: PATIENT_SORT.sortable,
  });

  const handleTabChange = (tab: PatientTab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === PatientTab.Inactive) {
      setOrderBy(PATIENT_SORT.orderBy[2]);
      setOrder(SORT_DIRECTION.desc);
    } else {
      setOrderBy(PATIENT_SORT.orderBy[0]);
      setOrder(SORT_DIRECTION.asc);
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [togglePatient, setTogglePatient] = useState<Patient | null>(null);
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
        order,
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
        <TabNav
          items={[
            { key: PatientTab.Active, label: "Activos" },
            { key: PatientTab.Inactive, label: "Inactivos" },
          ]}
          active={activeTab}
          onSelect={(key) => handleTabChange(key as PatientTab)}
          testIdPrefix="patients-tab"
        />
        <FilterBar
          {...searchProps}
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
          renderRow={(p) => {
            const isActive = p.status === PatientStatus.ACTIVE;
            return (
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
                      setTogglePatient(p);
                    }}
                    className={isActive ? "btn-action-delete" : "btn-action-activate"}
                    data-testid={`patient-delete-button-${p.id}`}
                    title={isActive ? "Desactivar paciente" : "Reactivar paciente"}
                  >
                    {isActive ? (
                      <ACTION_ICONS.close size={14} />
                    ) : (
                      <ACTION_ICONS.retry size={14} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          );
          }}
          emptyState={
            <EmptyState
              icon={STATUS_ICONS.search}
              title={
                searchProps.value
                  ? "Sin resultados"
                  : "No hay pacientes aún"
              }
              sub={
                searchProps.value
                  ? "Prueba ajustando los filtros de búsqueda."
                  : 'Haz clic en "Nuevo Paciente" para agregar el primero.'
              }
            />
          }
          footer={
            <DataTableFooter
              page={page}
              total={total}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
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
      {togglePatient && (
        <TogglePatientModal
          patient={togglePatient}
          onClose={() => setTogglePatient(null)}
          onDone={() => {
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
            setTogglePatient(viewPatient);
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

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsPageContent />
    </Suspense>
  );
}
