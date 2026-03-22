"use client";;
import { useState, useMemo, Suspense } from "react";
import { useQueryState, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';

import Sidebar from '../../components/Navigation/Sidebar';
import { FetchPatientsFilters, Patient, PatientStatus } from "@/src/types/Patient";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { StatCard } from "@/src/components/Info/StatCard";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { ChannelIcon } from "@/src/components/Info/ChannelIcon";
import { DataTable, TableFooter } from "@/src/components/DataTable";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { ArchivePatientModal } from "@/src/components/Modals/ArchivedPatientModal";
import { Channel } from "@/src/types/Reminder";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { PatientDrawer } from "@/src/components/Drawers/PatientDrawer";
import { PatientStatusPill } from "@/src/components/Info/StatusPill";
import { EmptyState } from "@/src/components/EmptyState";
import { useDebounceState } from "@/src/utils/useDebounceState";
import { useFetchPatientsStats } from "@/src/api/useFetchPatientsStats";

const PAGE_SIZE = 10;

function PatientsPageContent() {
  const { stats, fetchStats } = useFetchPatientsStats();

  const [ filterStatus, setFilterStatus ] = useQueryState("filterStatus", parseAsStringEnum<PatientStatus | "ALL">([ "ALL", PatientStatus.ACTIVE, PatientStatus.INACTIVE, PatientStatus.ARCHIVED ]).withDefault("ALL"));
  const [ page, setPage ] = useQueryState("page", parseAsInteger.withDefault(1));
  const [ search, setSearch ] = useQueryState("search", parseAsString.withDefault(""));
  const debouncedSearch = useDebounceState(search, 250);

  const [ showCreate, setShowCreate ] = useState(false);
  const [ editPatient, setEditPatient ] = useState<Patient | null>(null);
  const [ deletePatient, setDeletePatient ] = useState<Patient | null>(null);
  const [ viewPatient, setViewPatient ] = useState<Patient | null>(null);

  const filters = useMemo<FetchPatientsFilters>(() => ({
    search: debouncedSearch,
    status: filterStatus !== "ALL" ? filterStatus : undefined,
    page,
    pageSize: PAGE_SIZE,
    orderBy: 'name',
    order: 'asc',
  }), [ debouncedSearch, filterStatus, page ]);

  const { patients, loading, error, fetchPatients, total, totalPages } = useFetchPatients(filters);

  return (
    <>
      <div className="page-shell">
        <Sidebar />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h1 className="page-title">Pacientes</h1>
              <p className="page-subtitle">
                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="page-header__actions">
              <button onClick={() => setShowCreate(true)} className="btn-primary btn-hero">
                <span className="btn-plus-icon">+</span> Nuevo Paciente
              </button>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard label="Total Pacientes" value={stats?.total ?? 0} sub="en el sistema" accent="var(--c-brand)" />
            <StatCard label="Activos" value={stats?.byStatus[ PatientStatus.ACTIVE ] ?? 0} sub="reciben notificaciones" accent="var(--c-success)" />
            <StatCard label="Inactivos" value={stats?.byStatus[ PatientStatus.INACTIVE ] ?? 0} sub="sin notificaciones" accent="var(--c-warning)" />
          </div>
          <div className="filter-bar">
            <div className="search-wrapper">
              <input
                placeholder="Buscar por nombre, apellido o correo…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                autoComplete="new-password"
                className="form-input"
              />
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="search-clear-btn"
                aria-label="Limpiar búsqueda"
              >✕</button>
            </div>
            <div className="filter-chips">
              {([
                { key: "ALL", label: "Todos" },
                { key: PatientStatus.ACTIVE, label: "Activos" },
                { key: PatientStatus.INACTIVE, label: "Inactivos" },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => { setFilterStatus(key); setPage(1); }} className={`filter-chip ${filterStatus === key ? "filter-chip--active" : ""}`}>{label}</button>
              ))}
            </div>
          </div>
          {error && <ErrorBanner msg={error} onRetry={fetchPatients} />}
          <DataTable
            columns={[ "Paciente", "Correo", "WhatsApp", "SMS", "Estado", "Registrado", "" ]}
            rows={patients}
            loading={loading}
            skeletonCount={5}
            renderRow={(p) => (
              <tr onClick={() => setViewPatient(p)} key={p.id} className="table-row">
                <td className="td">
                  <div className="td-identity">
                    <div className="avatar avatar--md" style={{ background: getAvatarColor(p.id) }}>
                      {getInitials(p.name, p.lastName)}
                    </div>
                    <div className="td-name__primary">{p.name} {p.lastName}</div>
                  </div>
                </td>
                <td className="td td--date">
                  {p.email
                    ? <a href={`mailto:${p.email}`} className="td-email-link">{p.email}</a>
                    : <span className="td-email-empty"><span className="td-email-empty__dash">—</span></span>}
                </td>
                <td className="td"><ChannelIcon type={Channel.WHATSAPP} value={p.whatsappNumber} /></td>
                <td className="td"><ChannelIcon type={Channel.SMS} value={p.smsNumber} /></td>
                <td className="td"><PatientStatusPill status={p.status} /></td>
                <td className="td td--muted td--nowrap">
                  {new Date(p.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="td" onClick={e => e.stopPropagation()}>
                  <div className="td-actions">
                    <button onClick={e => { e.stopPropagation(); setEditPatient(p); }} className="btn-action-edit">Editar</button>
                    <button onClick={e => { e.stopPropagation(); setDeletePatient(p); }} className="btn-action-delete">✕</button>
                  </div>
                </td>
              </tr>
            )}
            emptyState={
              <EmptyState
                icon="🔍"
                title={search || filterStatus !== "ALL" ? "Sin resultados" : "No hay pacientes aún"}
                sub={search || filterStatus !== "ALL"
                  ? "Prueba ajustando los filtros de búsqueda."
                  : "Haz clic en \"Nuevo Paciente\" para agregar el primero."}
              />
            }
            footer={<TableFooter page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} label="pacientes" onPageChange={setPage} />}
          />
        </main>
      </div>
      {showCreate && (
        <PatientModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { fetchPatients(); fetchStats(); }}
        />
      )}
      {editPatient && (
        <PatientModal
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSaved={() => { fetchPatients(); fetchStats(); }}
        />
      )}
      {deletePatient && (
        <ArchivePatientModal
          patient={deletePatient}
          onClose={() => setDeletePatient(null)}
          onDeleted={() => { fetchPatients(); fetchStats(); }}
        />
      )}
      {viewPatient && (
        <PatientDrawer
          patient={viewPatient}
          onClose={() => setViewPatient(null)}
          onDelete={() => { setDeletePatient(viewPatient); setViewPatient(null) }}
          onEdit={() => { setEditPatient(viewPatient); setViewPatient(null) }}
        />
      )}
    </>
  );
}

export default function PatientsPage() {
  return <Suspense><PatientsPageContent /></Suspense>;
}
