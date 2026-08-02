import {
  AuditLog,
  ACTION_TYPE_CONFIG,
  ACTION_SOURCE_CONFIG,
} from "@/src/types/AuditLog";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { Section, Row } from "./DrawerUtils";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { EntityTypePill } from "../Info/EntityTypePill";

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const d = Date.parse(v);
    if (!isNaN(d) && v.length >= 10 && v.length <= 25) {
      try {
        return fmtDateTime(v);
      } catch {
        /* fall through */
      }
    }
    return v;
  }
  if (Array.isArray(v)) return `${v.length} elemento${v.length !== 1 ? "s" : ""}`;
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    return entries.length > 0
      ? entries.map(([k, val]) => `${k}: ${val}`).join(", ")
      : "Objeto vacío";
  } 
  return String(v);
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  lastName: "Apellido",
  email: "Correo",
  whatsappNumber: "WhatsApp",
  smsNumber: "SMS",
  phone: "Teléfono",
  dateOfBirth: "Fecha de Nacimiento",
  notes: "Notas",
  status: "Estado",
  type: "Tipo",
  channel: "Canal",
  sendAt: "Programado para",
  sentAt: "Enviado el",
  paid: "Pagado",
  location: "Ubicación",
  locationId: "Ubicación",
  typeId: "Tipo de Cita",
  patientId: "Paciente",
  appointmentId: "Cita",
  startAt: "Inicio",
  endAt: "Fin",
  reason: "Razón",
  duration: "Duración",
  capacity: "Capacidad",
  createdAt: "Creado",
  updatedAt: "Actualizado",
  deletedAt: "Eliminado",
  source: "Fuente",
  error: "Error",
  consentDocumentUrl: "Documento",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditDrawer({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  const actionCfg = ACTION_TYPE_CONFIG[log.actionType];

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
              <div className="drawer-header__status" >
                <EntityTypePill entityType={log.entityType} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <Section title="Actor">
            <Row
              icon={DETAIL_ICONS.id}
              label="Usuario"
              value={
                <span>
                  {log.actorDisplayName}{" "}
                  <span className="mono-sm" style={{ color: "var(--c-gray-400)" }}>
                    {log.actorId}
                  </span>
                </span>
              }
            />
          </Section>
          
          <Section title="Descripción">
            <div style={{ fontSize: 13, color: "var(--c-gray-700)" }}>
              {log.description}
            </div>
          </Section>

          {log.reason && (
            <Section title="Razón">
              <div style={{ fontSize: 13, color: "var(--c-gray-700)" }}>
                {log.reason}
              </div>
            </Section>
          )}

          {log.fieldsBefore && log.fieldsAfter && (
            <Section title="Cambios">
              {log.affectedFields.map((field) => {
                const before = log.fieldsBefore?.[field];
                const after = log.fieldsAfter?.[field];
                return (
                  <div
                    key={field}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--c-gray-100)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--c-gray-500)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {fieldLabel(field)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--c-gray-400)", textDecoration: "line-through", flex: 1 }}>
                        {formatValue(before)}
                      </span>
                      <span style={{ color: "var(--c-gray-300)", fontSize: 11 }}>&rarr;</span>
                      <span style={{ fontSize: 12, color: "var(--c-gray-900)", fontWeight: 500, flex: 1 }}>
                        {formatValue(after)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          {log.fieldsBefore && !log.fieldsAfter && (
            <Section title="Datos eliminados">
              {Object.entries(log.fieldsBefore).map(([key, val]) => (
                <Row
                  key={key}
                  icon={DETAIL_ICONS.note}
                  label={fieldLabel(key)}
                  value={formatValue(val)}
                />
              ))}
            </Section>
          )}

          {log.fieldsAfter && !log.fieldsBefore && (
            <Section title="Datos creados">
              {Object.entries(log.fieldsAfter).map(([key, val]) => (
                <Row
                  key={key}
                  label={fieldLabel(key)}
                  value={formatValue(val)}
                  icon={null}
                />
              ))}
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

          <Section title="Información del sistema">
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
