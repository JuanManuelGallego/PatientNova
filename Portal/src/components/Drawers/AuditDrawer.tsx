import {
  AuditLog,
  ACTION_TYPE_CONFIG,
  ENTITY_TYPE_CONFIG,
  ACTION_SOURCE_CONFIG,
} from "@/src/types/AuditLog";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { Section, Row } from "./DrawerUtils";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";

export function AuditDrawer({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  const actionCfg = ACTION_TYPE_CONFIG[log.actionType];
  const entityCfg = ENTITY_TYPE_CONFIG[log.entityType];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-backdrop" />
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="drawer-header"
          style={{
            background: actionCfg.bg,
            borderBottom: `3px solid ${actionCfg.color}`,
          }}
        >
          <div className="drawer-header__top">
            <div>
              <h2 className="drawer-header__title">{actionCfg.label}</h2>
              <div className="drawer-header__status">
                {entityCfg.label}
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <Section title="Actor">
            <div style={{ fontSize: 13, color: "var(--c-gray-700)" }}>
              {log.actorDisplayName} - <span className="mono-sm">{log.actorId}</span>
            </div>
          </Section>
          
          <Section title="Descripcion">
            <div style={{ fontSize: 13, color: "var(--c-gray-700)" }}>
              {log.description}
            </div>
          </Section>

          {log.reason && (
            <Section title="Razon">
              <div style={{ fontSize: 13, color: "var(--c-gray-700)" }}>
                {log.reason}
              </div>
            </Section>
          )}

          {log.fieldsBefore && log.fieldsAfter && (
            <Section title="Cambios">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {log.affectedFields.map((field) => {
                  const before = log.fieldsBefore?.[field];
                  const after = log.fieldsAfter?.[field];
                  return (
                    <div
                      key={field}
                      style={{
                        fontSize: 12,
                        display: "flex",
                        gap: 6,
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--c-gray-700)",
                          minWidth: 80,
                        }}
                      >
                        {field}
                      </span>
                      <span
                        style={{
                          color: "var(--c-gray-400)",
                          textDecoration: "line-through",
                        }}
                      >
                        {JSON.stringify(before)}
                      </span>
                      <span style={{ color: "var(--c-gray-400)" }}>
                        &rarr;
                      </span>
                      <span style={{ color: "var(--c-gray-700)" }}>
                        {JSON.stringify(after)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {log.fieldsBefore && !log.fieldsAfter && (
            <Section title="Datos eliminados">
              <pre
                style={{
                  fontSize: 12,
                  color: "var(--c-gray-700)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  padding: 8,
                  background: "var(--c-gray-100)",
                  borderRadius: 6,
                }}
              >
                {JSON.stringify(log.fieldsBefore, null, 2)}
              </pre>
            </Section>
          )}

          {log.fieldsAfter && !log.fieldsBefore && (
            <Section title="Datos creados">
              <pre
                style={{
                  fontSize: 12,
                  color: "var(--c-gray-700)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  padding: 8,
                  background: "var(--c-gray-100)",
                  borderRadius: 6,
                }}
              >
                {JSON.stringify(log.fieldsAfter, null, 2)}
              </pre>
            </Section>
          )}

          <Section title="Metadata">
            <Row
              icon={DETAIL_ICONS.flag}
              label="Fuente"
              value={ACTION_SOURCE_CONFIG[log.source].label}
            />
            {log.ipAddress && (
              <Row
                icon={DETAIL_ICONS.link}
                label="IP"
                value={<span className="mono">{log.ipAddress}</span>}
              />
            )}
            <Row
              icon={DETAIL_ICONS.id}
              label="Entidad ID"
              value={<span className="mono-sm">{log.entityId}</span>}
            />
          </Section>

          <Section title="Informacion del sistema">
            <Row
              icon={DETAIL_ICONS.clock}
              label="Fecha"
              value={<span className="td--dateTime">{fmtDateTime(log.eventTimeUtc)}</span>}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
