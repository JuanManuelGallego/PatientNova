import { useFetchAuditLogs } from "@/src/api/audit-logs";
import { AuditLog, EntityType, ActionType, ENTITY_TYPE_CONFIG, ACTION_TYPE_CONFIG, FetchAuditLogsFilters } from "@/src/types/AuditLog";
import { CustomSelect, SelectOption } from "@/src/components/CustomSelect";
import { DataTable, TableFooter } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { AuditDrawer } from "@/src/components/Drawers/AuditDrawer";
import { ActionPill } from "@/src/components/Info/ActionPill";
import { FilterBar } from "@/src/components/FilterBar";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";
import { useDebounceState } from "@/src/hooks/useDebounceState";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { ACTION_ICONS } from "@/src/config/icons";
import { useMemo, useState } from "react";
import {
  useQueryState,
  parseAsInteger,
  parseAsString,
} from "nuqs";
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

export function AuditLogsTab() {
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const debouncedSearch = useDebounceState(search, 250);
  const [entityType, setEntityType] = useQueryState("entityType", parseAsString.withDefault(""));
  const [actionType, setActionType] = useQueryState("actionType", parseAsString.withDefault(""));
  const [dateFilter, setDateFilter] = useQueryState("dateFilter", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  const filters = useMemo<FetchAuditLogsFilters>(
    () => ({
      entityType: ( entityType as EntityType ) || undefined,
      actionType: ( actionType as ActionType ) || undefined,
      search: debouncedSearch.trim() || undefined,
      dateFrom: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
      dateTo: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
      page,
      pageSize: PAGE_SIZE,
      orderBy: "eventTimeUtc",
      order: "desc",
    }),
    [entityType, actionType, debouncedSearch, dateFilter, page],
  );

  const { auditLogs, loading, error, totalPages, total } = useFetchAuditLogs(filters);
  const showSpinner = useDelayedLoading(loading);

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

      <FilterBar
        value={search}
        onChange={setSearch}
        onClear={() => {
          setSearch("");
          setPage(1);
          setEntityType("");
          setActionType("");
          setDateFilter("");
        }}
        placeholder="Buscar por actor, descripcion o entidad…"
        wrap
      >
        <CustomSelect
          value={entityType}
          options={ENTITY_OPTIONS}
          onChange={(v) => { setEntityType(v); setPage(1); }}
          className="form-input--auto"
        />
        <CustomSelect
          value={actionType}
          options={ACTION_OPTIONS}
          onChange={(v) => { setActionType(v); setPage(1); }}
          className="form-input--auto"
        />
        <DateTimePicker
          date={dateFilter}
          onChanged={(iso) => setDateFilter(iso.slice(0, 10))}
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="btn-secondary btn-secondary--sm"
          >
            <ACTION_ICONS.close size={12} /> Fecha
          </button>
        )}
      </FilterBar>

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
            onPageChange={setPage}
          />
        }
      />
      {viewLog && <AuditDrawer log={viewLog} onClose={() => setViewLog(null)} />}
    </div>
  );
}
