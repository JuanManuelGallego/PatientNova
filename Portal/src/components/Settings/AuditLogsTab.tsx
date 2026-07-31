import { useFetchAuditLogs } from "@/src/api/audit-logs";
import { AuditLog, EntityType, ActionType, ActionSource, ENTITY_TYPE_CONFIG, ACTION_TYPE_CONFIG, ACTION_SOURCE_CONFIG, FetchAuditLogsFilters } from "@/src/types/AuditLog";
import { CustomSelect, SelectOption } from "@/src/components/CustomSelect";
import { Clock, ChevronDown } from "lucide-react";
import { PAGINATION_ICONS } from "@/src/config/icons";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";
import { useState } from "react";

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

function AuditLogCard({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const actionCfg = ACTION_TYPE_CONFIG[log.actionType];
  const entityCfg = ENTITY_TYPE_CONFIG[log.entityType];

  return (
    <div
      className="location-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderLeft: `4px solid ${actionCfg.color}`,
        height: "auto",
        minHeight: 65,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {log.actorDisplayName}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: actionCfg.color,
                background: actionCfg.bg,
                padding: "1px 8px",
                borderRadius: 6,
              }}
            >
              {actionCfg.label}
            </span>
            <span style={{ fontSize: 12, color: "var(--c-gray-500)" }}>
              {entityCfg.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--c-gray-700)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {log.description}
          </div>
          {log.affectedFields.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "var(--c-gray-400)",
                marginTop: 3,
              }}
            >
              Campos: {log.affectedFields.join(", ")}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--c-gray-400)", whiteSpace: "nowrap" }}>
            {relativeTime(log.eventTimeUtc)}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: "var(--c-gray-400)",
              transition: "transform 0.15s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>
      </div>
      {expanded && (
        <div
          style={{
            padding: "0 16px 14px",
            borderTop: "1px solid var(--c-gray-100)",
          }}
        >
          <div style={{ paddingTop: 10 }}>
            {log.reason && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Razon
                </span>
                <div style={{ fontSize: 13, color: "var(--c-gray-700)", marginTop: 2 }}>
                  {log.reason}
                </div>
              </div>
            )}
            {log.fieldsBefore && log.fieldsAfter && (
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cambios
                </span>
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                  {log.affectedFields.map((field) => {
                    const before = log.fieldsBefore?.[field];
                    const after = log.fieldsAfter?.[field];
                    return (
                      <div key={field} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "baseline" }}>
                        <span style={{ fontWeight: 600, color: "var(--c-gray-700)", minWidth: 80 }}>
                          {field}
                        </span>
                        <span style={{ color: "var(--c-gray-400)", textDecoration: "line-through" }}>
                          {JSON.stringify(before)}
                        </span>
                        <span style={{ color: "var(--c-gray-400)" }}>&rarr;</span>
                        <span style={{ color: "var(--c-gray-700)" }}>
                          {JSON.stringify(after)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {log.fieldsBefore && !log.fieldsAfter && (
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Datos eliminados
                </span>
                <pre style={{ fontSize: 12, color: "var(--c-gray-700)", marginTop: 4, whiteSpace: "pre-wrap", margin: 0, padding: 8, background: "var(--c-gray-100)", borderRadius: 6 }}>
                  {JSON.stringify(log.fieldsBefore, null, 2)}
                </pre>
              </div>
            )}
            {log.fieldsAfter && !log.fieldsBefore && (
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Datos creados
                </span>
                <pre style={{ fontSize: 12, color: "var(--c-gray-700)", marginTop: 4, whiteSpace: "pre-wrap", margin: 0, padding: 8, background: "var(--c-gray-100)", borderRadius: 6 }}>
                  {JSON.stringify(log.fieldsAfter, null, 2)}
                </pre>
              </div>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 11, color: "var(--c-gray-400)" }}>
              <span>Fuente: {ACTION_SOURCE_CONFIG[log.source].label}</span>
              {log.ipAddress && <span>IP: {log.ipAddress}</span>}
              <span>ID: {log.entityId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditLogsTab() {
  const [filters, setFilters] = useState<FetchAuditLogsFilters>({
    page: 1,
    pageSize: 20,
    orderBy: "eventTimeUtc",
    order: "desc",
  });
  const { auditLogs, loading, error, totalPages } = useFetchAuditLogs(filters);
  const showSpinner = useDelayedLoading(loading);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateFilter(key: keyof FetchAuditLogsFilters, value: unknown) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }

  const page = filters.page ?? 1;

  return (
    <div style={{ maxWidth: 720 }}>
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

      {showSpinner ? (
        <div className="dash-card">
          <div
            className="dash-card__body"
            style={{ textAlign: "center", padding: "48px 24px", color: "var(--c-gray-400)" }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>&#9203;</div>
            Cargando registros...
          </div>
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="dash-card">
          <div
            className="dash-card__body"
            style={{ textAlign: "center", padding: "48px 24px" }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                margin: "0 auto 16px",
                background: "var(--c-gray-100)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={32} />
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--c-gray-700)",
                marginBottom: 4,
              }}
            >
              Sin registros de actividad
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--c-gray-400)",
                marginBottom: 20,
              }}
            >
              Las acciones realizadas en el sistema aparecerán aquí.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {auditLogs.map((log) => (
            <AuditLogCard
              key={log.id}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
            />
          ))}
        </div>
      )}

      {!showSpinner && totalPages > 1 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))}
              disabled={page === 1}
            >
              <PAGINATION_ICONS.prev size={14} /> Anterior
            </button>
            <span style={{ fontSize: 13, color: "var(--c-gray-400)", padding: "0 8px" }}>
              Pagina <strong style={{ color: "var(--c-gray-700)" }}>{page}</strong> de{" "}
              <strong style={{ color: "var(--c-gray-700)" }}>{totalPages}</strong>
            </span>
            <button
              className="pagination-btn"
              onClick={() => setFilters((p) => ({ ...p, page: Math.min(totalPages, (p.page ?? 1) + 1) }))}
              disabled={page === totalPages}
            >
              Siguiente <PAGINATION_ICONS.next size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
