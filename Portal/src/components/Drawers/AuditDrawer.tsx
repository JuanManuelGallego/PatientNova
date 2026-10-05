import {
  AuditLog,
  ACTION_TYPE_CONFIG,
  ACTION_SOURCE_CONFIG,
} from "@/src/types/AuditLog";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { DrawerShell, Section, Row } from "./DrawerUtils";
import { DETAIL_ICONS } from "@/src/config/icons";
import { EntityTypePill } from "../Info/EntityTypePill";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const date = Date.parse(value);
    if (!Number.isNaN(date) && value.length >= 10 && value.length <= 25) {
      try {
        return fmtDateTime(value);
      } catch {
        // Keep the original value when it only resembles a date.
      }
    }
    return value;
  }
  if (Array.isArray(value)) return `${value.length} elemento${value.length !== 1 ? "s" : ""}`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length > 0
      ? entries.map(([key, entry]) => `${key}: ${entry}`).join(", ")
      : "Objeto vacío";
  }
  return String(value);
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  lastName: "Apellido",
  email: "Correo",
  whatsappNumber: "WhatsApp",
  smsNumber: "SMS",
  reminderChannel: "Canal de recordatorios",
  phone: "Teléfono",
  dateOfBirth: "Fecha de Nacimiento",
  notes: "Notas",
  status: "Estado",
  type: "Tipo",
  channel: "Canal",
  subject: "Asunto",
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
  return (
    FIELD_LABELS[key] ??
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export function AuditDrawer({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  const action = ACTION_TYPE_CONFIG[log.actionType];

  return (
    <DrawerShell
      title={action.label}
      eyebrow="Registro de actividad"
      icon={DETAIL_ICONS.history}
      status={<EntityTypePill entityType={log.entityType} />}
      onClose={onClose}
      panelTestId="audit-drawer-panel"
      closeTestId="audit-drawer-close-button"
    >
      <Section title="Actor">
        <Row
          icon={DETAIL_ICONS.id}
          label="Usuario"
          value={
            <span className="drawer-actor">
              <span>{log.actorDisplayName}</span>
              <span className="mono-sm drawer-system-value">{log.actorId}</span>
            </span>
          }
        />
      </Section>

      <Section title="Descripción">
        <div className="drawer-prose">{log.description}</div>
      </Section>

      {log.reason && (
        <Section title="Razón">
          <div className="drawer-prose">{log.reason}</div>
        </Section>
      )}

      {log.fieldsBefore && log.fieldsAfter && (
        <Section title="Cambios">
          <div className="audit-changes">
            {log.affectedFields.map((field) => (
              <div className="audit-change" key={field}>
                <div className="audit-change__field">{fieldLabel(field)}</div>
                <div className="audit-change__comparison">
                  <div className="audit-change__value audit-change__value--before">
                    <span className="audit-change__label">Antes</span>
                    <span>{formatValue(log.fieldsBefore?.[field])}</span>
                  </div>
                  <span className="audit-change__arrow" aria-hidden="true">→</span>
                  <div className="audit-change__value audit-change__value--after">
                    <span className="audit-change__label">Después</span>
                    <span>{formatValue(log.fieldsAfter?.[field])}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {log.fieldsBefore && !log.fieldsAfter && (
        <Section title="Datos eliminados">
          {Object.entries(log.fieldsBefore).map(([key, value]) => (
            <Row key={key} icon={DETAIL_ICONS.note} label={fieldLabel(key)} value={formatValue(value)} />
          ))}
        </Section>
      )}

      {log.fieldsAfter && !log.fieldsBefore && (
        <Section title="Datos creados">
          {Object.entries(log.fieldsAfter).map(([key, value]) => (
            <Row key={key} icon={null} label={fieldLabel(key)} value={formatValue(value)} />
          ))}
        </Section>
      )}

      <Section title="Metadata" quiet>
        <Row icon={DETAIL_ICONS.flag} label="Fuente" value={ACTION_SOURCE_CONFIG[log.source].label} />
        {log.ipAddress && <Row icon={DETAIL_ICONS.link} label="IP" value={<span className="mono">{log.ipAddress}</span>} />}
        <Row icon={DETAIL_ICONS.id} label="Entidad ID" value={<span className="mono-sm">{log.entityId}</span>} />
      </Section>

      <Section title="Información del sistema" quiet>
        <Row icon={DETAIL_ICONS.clock} label="Fecha" value={<span className="td--dateTime">{fmtDateTime(log.eventTimeUtc)}</span>} />
      </Section>
    </DrawerShell>
  );
}
