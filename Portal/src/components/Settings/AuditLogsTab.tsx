import { useFetchAuditLogs } from "@/src/api/audit-logs/useFetchAuditLogs";
import { AuditLog, EntityType, ActionType, ENTITY_TYPE_CONFIG, ACTION_TYPE_CONFIG, FetchAuditLogsFilters } from "@/src/types/AuditLog";
import { SelectOption } from "@/src/components/CustomSelect";
import {
  DataTable,
  DataTableFooter,
  ColumnDef,
} from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { AuditDrawer } from "@/src/components/Drawers/AuditDrawer";
import { ActionPill } from "@/src/components/Info/ActionPill";
import { FilterBar } from "@/src/components/FilterBar";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";
import { fmtTimestamp } from "@/src/utils/TimeUtils";
import { ACTION_ICONS } from "@/src/config/icons";
import { useMemo, useState } from "react";
import {
  useQueryState,
  parseAsString,
  parseAsArrayOf,
} from "nuqs";
import { Clock } from "lucide-react";
import { EntityTypePill } from "../Info/EntityTypePill";
import { useListQueryState } from "@/src/hooks/useListQueryState";
import { useDateRangeFilter } from "@/src/hooks/useDateRangeFilter";
import { withAllOption } from "@/src/utils/options";
import {
  PAGE_SIZE,
  QUERY_PARAMS,
  AUDIT_SORT,
  SORT_DIRECTION,
  type AuditOrderBy,
} from "@/src/utils/listQuery";

const ENTITY_OPTIONS: SelectOption[] = withAllOption(
  Object.values(EntityType),
  (v) => ENTITY_TYPE_CONFIG[v].label,
  "Todas",
);

const ACTION_OPTIONS: SelectOption[] = withAllOption(
  Object.values(ActionType),
  (v) => ACTION_TYPE_CONFIG[v].label,
  "Todas",
);

export function AuditLogsTab() {
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);
  const [entityType, setEntityType] = useQueryState(QUERY_PARAMS.auditEntityType, parseAsArrayOf(parseAsString).withDefault([]));
  const [actionType, setActionType] = useQueryState(QUERY_PARAMS.auditActionType, parseAsArrayOf(parseAsString).withDefault([]));
  const { range: dateFilter, setRange: setDateFilter } = useDateRangeFilter(QUERY_PARAMS.auditDate);
  const [entityId, setEntityId] = useQueryState(QUERY_PARAMS.auditEntityId, parseAsString.withDefault(""));

  const {
    page,
    setPage,
    debouncedSearch,
    orderBy,
    order,
    handleSort,
    searchProps,
  } = useListQueryState<AuditOrderBy>({
    orderByOptions: AUDIT_SORT.orderBy,
    orderByDefault: AUDIT_SORT.orderBy[0],
    sortable: AUDIT_SORT.sortable,
    orderDefault: SORT_DIRECTION.desc,
  });

  const filters = useMemo<FetchAuditLogsFilters>(
    () => ({
      entityType: entityType.length ? (entityType as EntityType[]) : undefined,
      entityId: entityId.trim() || undefined,
      actionType: actionType.length ? (actionType as ActionType[]) : undefined,
      search: debouncedSearch.trim() || undefined,
      dateFrom: dateFilter?.[0] ? `${dateFilter[0]}T00:00:00.000Z` : undefined,
      dateTo: dateFilter?.[1] ? `${dateFilter[1]}T23:59:59.999Z` : undefined,
      page,
      pageSize: PAGE_SIZE,
      orderBy: orderBy as FetchAuditLogsFilters["orderBy"],
      order,
    }),
    [entityType, entityId, actionType, debouncedSearch, dateFilter, page, orderBy, order],
  );

  const columns = useMemo<ColumnDef[]>(
    () => [
      {
        label: "Accion",
        sortKey: "actionType",
        filter: {
          kind: "enum",
          options: ACTION_OPTIONS,
          value: actionType,
          onChange: (v: string[]) => { setActionType(v); setPage(1); },
          testId: "audit-action-filter",
          triggerTestId: "audit-action-filter-trigger",
        },
      },
      {
        label: "Entidad",
        sortKey: "entityType",
        filter: {
          kind: "enum",
          options: ENTITY_OPTIONS,
          value: entityType,
          onChange: (v: string[]) => { setEntityType(v); setPage(1); },
          testId: "audit-entity-filter",
          triggerTestId: "audit-entity-filter-trigger",
        },
      },
      { label: "Descripcion" },
      {
        label: "Fecha",
        sortKey: "eventTimeUtc",
        filter: {
          kind: "date-range",
          value: dateFilter,
          onChange: (range) => { setDateFilter(range); setPage(1); },
          testId: "audit-date-range-filter",
          triggerTestId: "audit-date-range-filter-trigger",
        },
      },
    ],
    [actionType, entityType, dateFilter, setActionType, setEntityType, setDateFilter, setPage],
  );

  const { auditLogs, loading, error, fetchAuditLogs, totalPages, total } = useFetchAuditLogs(filters);
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
        <button
          onClick={() => fetchAuditLogs()}
          className="btn-secondary btn-secondary--sm"
          title="Actualizar"
          data-testid="audit-refresh-button"
        >
          <ACTION_ICONS.retry size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <FilterBar
        {...searchProps}
        placeholder="Buscar por actor, descripcion o entidad…"
        testId="audit-search-input"
      />
      {entityId && (
        <button
          onClick={() => { setEntityId(""); setPage(1); }}
          className="btn-secondary btn-secondary--sm"
          style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}
        >
          <ACTION_ICONS.close size={12} /> Entidad
        </button>
      )}

      {error && (
        <div className="error-inline" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

        <DataTable
          columns={columns}
          rows={auditLogs}
          loading={showSpinner}
          skeletonCount={5}
          testId="audit-table"
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          total={total}
        renderRow={(log) => (
          <tr key={log.id} className="table-row" onClick={() => setViewLog(log)} data-testid={`audit-row-${log.id}`}>
            <td className="td">
              <ActionPill action={log.actionType} />
            </td>
            <td className="td">
              <EntityTypePill entityType={log.entityType} />
            </td>
            <td className="td td--date" >{log.description}</td>
            <td className="td td--date">{fmtTimestamp(log.eventTimeUtc)}</td>
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
          <DataTableFooter
            page={page}
            total={total}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            label="registros"
            onPageChange={setPage}
            testIdPrefix="audit-pagination"
          />
        }
      />
      {viewLog && <AuditDrawer log={viewLog} onClose={() => setViewLog(null)} />}
    </div>
  );
}
