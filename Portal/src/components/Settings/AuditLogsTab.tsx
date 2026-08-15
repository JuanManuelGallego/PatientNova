import { useFetchAuditLogs } from "@/src/api/audit-logs/useFetchAuditLogs";
import { AuditLog, EntityType, ActionType, ENTITY_TYPE_CONFIG, ACTION_TYPE_CONFIG, FetchAuditLogsFilters } from "@/src/types/AuditLog";
import { SelectOption } from "@/src/components/CustomSelect";
import { DataTable, TableFooter, ColumnDef } from "@/src/components/DataTable";
import { EmptyState } from "@/src/components/EmptyState";
import { AuditDrawer } from "@/src/components/Drawers/AuditDrawer";
import { ActionPill } from "@/src/components/Info/ActionPill";
import { FilterBar } from "@/src/components/FilterBar";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";
import { useDebounceState } from "@/src/hooks/useDebounceState";
import { fmtTimestamp } from "@/src/utils/TimeUtils";
import { ACTION_ICONS } from "@/src/config/icons";
import { useMemo, useState } from "react";
import {
  useQueryState,
  parseAsInteger,
  parseAsString,
  parseAsArrayOf,
  parseAsStringEnum,
} from "nuqs";
import { Clock } from "lucide-react";
import { EntityTypePill } from "../Info/EntityTypePill";

const PAGE_SIZE = 10;

const AUDIT_ORDER_BY = [
  "eventTimeUtc",
  "entityType",
  "actionType",
  "source",
  "actorId",
] as const;

const AUDIT_SORTABLE_COLUMNS = [
  "eventTimeUtc",
  "entityType",
  "actionType",
] as const;

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
  const [entityType, setEntityType] = useQueryState("entityType", parseAsArrayOf(parseAsString).withDefault([]));
  const [actionType, setActionType] = useQueryState("actionType", parseAsArrayOf(parseAsString).withDefault([]));
  const [dateFilter, setDateFilter] = useQueryState("dateFilter", parseAsString.withDefault(""));
  const [entityId, setEntityId] = useQueryState("entityId", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [orderBy, setOrderBy] = useQueryState(
    "orderBy",
    parseAsStringEnum([...AUDIT_ORDER_BY]).withDefault("eventTimeUtc"),
  );
  const [order, setOrder] = useQueryState(
    "order",
    parseAsStringEnum(["asc", "desc"]).withDefault("desc"),
  );

  const handleSort = (sortKey: string) => {
    if (!(AUDIT_SORTABLE_COLUMNS as readonly string[]).includes(sortKey)) return;
    if (orderBy === sortKey) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(sortKey as typeof orderBy);
      setOrder("asc");
    }
    setPage(1);
  };

  const filters = useMemo<FetchAuditLogsFilters>(
    () => ({
      entityType: entityType.length ? (entityType as EntityType[]) : undefined,
      entityId: entityId.trim() || undefined,
      actionType: actionType.length ? (actionType as ActionType[]) : undefined,
      search: debouncedSearch.trim() || undefined,
      dateFrom: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
      dateTo: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
      page,
      pageSize: PAGE_SIZE,
      orderBy: orderBy as FetchAuditLogsFilters["orderBy"],
      order: order as "asc" | "desc",
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
          kind: "date",
          value: dateFilter,
          onChange: (iso) => { setDateFilter(iso); setPage(1); },
          testId: "audit-date-from-filter",
          triggerTestId: "audit-date-from-filter-trigger",
        },
      },
    ],
    [actionType, entityType, dateFilter, setActionType, setEntityType, setDateFilter, setPage],
  );

  const handleSearchClear = () => {
    setSearch("");
    setPage(1);
  };

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
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        onClear={handleSearchClear}
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
          <TableFooter
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
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
