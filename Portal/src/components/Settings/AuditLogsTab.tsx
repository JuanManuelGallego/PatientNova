import { useFetchAuditLogs } from "@/src/api/audit-logs";
import { AuditLog, EntityType, ActionType, ActionSource, ENTITY_TYPE_CONFIG, ACTION_TYPE_CONFIG, ACTION_SOURCE_CONFIG, FetchAuditLogsFilters } from "@/src/types/AuditLog";
import { CustomSelect, SelectOption } from "@/src/components/CustomSelect";
import { DataTable, TableFooter } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { AuditDrawer } from "@/src/components/Drawers/AuditDrawer";
import { ActionPill } from "@/src/components/Info/ActionPill";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { useState } from "react";
import { Clock } from "lucide-react";

const PAGE_SIZE = 20;

const ENTITY_OPTIONS: SelectOption[] = [
  { value: "", label: "Todas" },
  ...Object.values(EntityType).map((v) => ({ value: v, label: ENTITY_TYPE_CONFIG[v].label })),
];

const ACTION_OPTIONS: SelectOption[] = [
  { value: "", label: "Todas" },
  ...Object.values(ActionType).map((v) => ({ value: v, label: ACTION_TYPE_CONFIG[v].label })),
];

const SOURCE_OPTIONS: SelectOption[] = [
  { value: "", label: "Todas" },
  ...Object.values(ActionSource).map((v) => ({ value: v, label: ACTION_SOURCE_CONFIG[v].label })),
];

export function AuditLogsTab() {
  const [filters, setFilters] = useState<FetchAuditLogsFilters>({
    page: 1,
    pageSize: PAGE_SIZE,
    orderBy: "eventTimeUtc",
    order: "desc",
  });
  const { auditLogs, loading, error, totalPages, total } = useFetchAuditLogs(filters);
  const showSpinner = useDelayedLoading(loading);
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);

  function updateFilter(key: keyof FetchAuditLogsFilters, value: unknown) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }

  const page = filters.page ?? 1;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--c-gray-700)",
            }}
          >
            Registro de actividad
          </div>
          <div
            style={{ fontSize: 12, color: "var(--c-gray-400)", marginTop: 2 }}
          >
            Historial de acciones realizadas en el sistema
          </div>
        </div>
      </div>

      <div className="form-grid-2" style={{ marginBottom: 16, gap: 12 }}>
        <label className="form-label">
          Tipo de entidad
          <CustomSelect
            value={filters.entityType ?? ""}
            options={ENTITY_OPTIONS}
            onChange={(v) => updateFilter("entityType", v)}
          />
        </label>
        <label className="form-label">
          Accion
          <CustomSelect
            value={filters.actionType ?? ""}
            options={ACTION_OPTIONS}
            onChange={(v) => updateFilter("actionType", v)}
          />
        </label>
        <label className="form-label">
          Fuente
          <CustomSelect
            value={filters.source ?? ""}
            options={SOURCE_OPTIONS}
            onChange={(v) => updateFilter("source", v)}
          />
        </label>
      </div>

      {error && (
        <div className="error-inline" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <DataTable
        columns={["Accion", "Descripcion", "Fecha"]}
        rows={auditLogs}
        loading={showSpinner}
        skeletonCount={5}
        renderRow={(log) => (
          <tr key={log.id} className="table-row" onClick={() => setViewLog(log)}>
            <td className="td">
              <ActionPill action={log.actionType} />
            </td>
            <td className="td td--date" >{log.description}</td>
            <td className="td td--date">{fmtDateTime(log.eventTimeUtc)}</td>
          </tr>
        )}
        emptyState={
          <EmptyState
            icon={Clock}
            title="Sin registros de actividad"
            sub="Las acciones realizadas en el sistema aparecerán aquí."
          />
        }
        footer={
          <TableFooter
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            label="registros"
            onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
          />
        }
      />
      {viewLog && <AuditDrawer log={viewLog} onClose={() => setViewLog(null)} />}
    </div>
  );
}
