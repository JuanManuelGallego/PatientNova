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
import { getAvatarColor, getInitials } from "@/src/utils/avatarHelper";
import { StatCard } from "@/src/components/Info/StatCard";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { ChannelPill } from "@/src/components/Info/ChannelPill";
import { DataTable, TableFooter } from "@/src/components/DataTable";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { DeletePatientModal } from "@/src/components/Modals/DeletePatientModal";
import { Channel } from "@/src/types/Reminder";
import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
import { PatientDrawer } from "@/src/components/Drawers/PatientDrawer";
import { PatientStatusPill } from "@/src/components/Info/StatusPill";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { Users, UserCheck, UserX } from "lucide-react";
import { EmptyState } from "@/src/components/EmptyState";
import { useDebounceState } from "@/src/hooks/useDebounceState";
import { useFetchPatientsStats } from "@/src/api/patients/useFetchPatientsStats";
import { FilterBar } from "@/src/components/FilterBar";
import { todayString } from "@/src/utils/timeUtils";

const PAGE_SIZE = 10;

function PatientsPageContent() {
  const { stats, fetchStats } = useFetchPatientsStats();

  const [filterStatus, setFilterStatus] = useQueryState(
    "filterStatus",
    parseAsStringEnum<PatientStatus | "All">([
      "All",
      PatientStatus.ACTIVE,
      PatientStatus.INACTIVE,
    ]).withDefault("All"),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const debouncedSearch = useDebounceState(search, 250);

  const [showCreate, setShowCreate] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);

  const filters = useMemo<FetchPatientsFilters>(
    () => ({
      search: debouncedSearch,
      status: filterStatus !== "All" ? filterStatus : undefined,
      page,
      pageSize: PAGE_SIZE,
      orderBy: "name",
      order: "asc",
    }),
    [debouncedSearch, filterStatus, page],
  );

  const { patients, loading, error, fetchPatients, total, totalPages } =
    useFetchPatients(filters);

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Pacientes"
          subtitle={todayString()}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary btn-hero"
            >
              Nuevo Paciente
            </button>
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
        >
          <div className="filter-chips">
            {(
              [
                { key: "All", label: "Todos" },
                { key: PatientStatus.ACTIVE, label: "Activos" },
                { key: PatientStatus.INACTIVE, label: "Inactivos" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setFilterStatus(key);
                  setPage(1);
                }}
                className={`filter-chip ${filterStatus === key ? "filter-chip--active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </FilterBar>
        {error && <ErrorBanner msg={error} onRetry={fetchPatients} />}
        <DataTable
          columns={[
            "Paciente",
            "Correo",
            "WhatsApp",
            "SMS",
            "Estado",
            "Registrado",
            "",
          ]}
          rows={patients}
          loading={loading}
          skeletonCount={5}
          renderRow={(p) => (
            <tr
              onClick={() => setViewPatient(p)}
              key={p.id}
              className="table-row"
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
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePatient(p);
                    }}
                    className="btn-action-delete"
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
                search || filterStatus !== "All"
                  ? "Sin resultados"
                  : "No hay pacientes aún"
              }
              sub={
                search || filterStatus !== "All"
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

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsPageContent />
    </Suspense>
  );
}
