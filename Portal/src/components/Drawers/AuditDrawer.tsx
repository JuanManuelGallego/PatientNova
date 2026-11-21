import {
  AuditLog,
  ACTION_TYPE_CONFIG,
  ACTION_SOURCE_CONFIG,
} from "@/src/types/AuditLog";
import { calendarDayOf, fmtCalendarDay, fmtDateTime, fmtDateTimeSeconds } from "@/src/utils/TimeUtils";
import { DrawerShell, Section, Row } from "./DrawerUtils";
import { DETAIL_ICONS } from "@/src/config/icons";
import { EntityTypePill } from "../Info/EntityTypePill";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { CHANNEL_CFG } from "@/src/types/Reminder";

const CHANNEL_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_CFG).map(([channel, config]) => [ channel, config.label ]),
);

const VALUE_LABELS: Record<string, Record<string, string>> = {
  status: {
    SCHEDULED: "Agendada",
    CONFIRMED: "Confirmada",
    COMPLETED: "Completada",
    CANCELLED: "Cancelada",
    NO_SHOW: "No asistió",
    PENDING: "Pendiente",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    EXPIRED: "Vencida",
    SENT: "Enviado",
    FAILED: "Fallido",
    QUEUED: "En cola",
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
  },
  cancelledBy: { PROVIDER: "Profesional", PATIENT: "Paciente" },
  meetingStatus: {
    NOT_REQUIRED: "No requerido",
    PENDING: "Generándose",
    NEEDS_LINK: "Falta el enlace",
    READY: "Listo",
  },
  kind: { DATA_PROCESSING: "Tratamiento de datos", NEW: "Nueva", REVIEW: "Para revisar" },
  source: { PROVIDER: "Profesional", PORTAL: "Portal de pacientes" },
  channel: CHANNEL_LABELS,
  reminderChannel: CHANNEL_LABELS,
  sendMode: { IMMEDIATE: "Inmediato", SCHEDULED: "Programado" },
};

/**
 * Keys of a nested record (an appointment's `reminder`) that mean nothing to a reader:
 * ids and the WhatsApp template plumbing. Older rows snapshot the whole relation.
 */
const HIDDEN_NESTED_KEYS = new Set(["id", "contentSid", "contentVariables"]);

const isHiddenNestedKey = (key: string) => HIDDEN_NESTED_KEYS.has(key) || key.endsWith("Id");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TEXT_FIELDS = new Set(["policyVersion"]);

const CALENDAR_DAY_FIELDS = new Set(["dateOfBirth", "birthDate"]);

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatString(value: string, timezone: string, field?: string): string {
  const label = field ? VALUE_LABELS[field]?.[value] : undefined;
  if (label) return label;
  if (field && TEXT_FIELDS.has(field)) return value;
  if ((field && CALENDAR_DAY_FIELDS.has(field)) || BARE_DATE.test(value)) {
    return calendarDayOf(value) ? fmtCalendarDay(value) : value;
  }
  if (ISO_INSTANT.test(value) && !Number.isNaN(Date.parse(value))) return fmtDateTime(value, timezone);
  return value;
}

function formatValue(value: unknown, timezone: string, field?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return formatString(value, timezone, field);
  if (Array.isArray(value)) return `${value.length} elemento${value.length !== 1 ? "s" : ""}`;
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([key, entry]) => !isHiddenNestedKey(key) && entry !== null && entry !== undefined);
    return entries.length > 0
      ? entries.map(([key, entry]) => `${fieldLabel(key)}: ${formatValue(entry, timezone, key)}`).join(" · ")
      : "—";
  }
  return String(value);
}

type FieldChange = { key: string; field: string; label: string; before: unknown; after: unknown };

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A nested record becomes one change per readable key that differs, labelled "Recordatorio · Estado". */
function expandChange(field: string, before: unknown, after: unknown): FieldChange[] {
  if (!isRecord(before) && !isRecord(after)) {
    return [ { key: field, field, label: fieldLabel(field), before, after } ];
  }
  const beforeRecord = isRecord(before) ? before : {};
  const afterRecord = isRecord(after) ? after : {};
  const keys = [ ...new Set([ ...Object.keys(beforeRecord), ...Object.keys(afterRecord) ]) ];
  return keys
    .filter((key) => !isHiddenNestedKey(key) && !sameValue(beforeRecord[key], afterRecord[key]))
    .map((key) => ({
      key: `${field}.${key}`,
      field: key,
      label: `${fieldLabel(field)} · ${fieldLabel(key)}`,
      before: beforeRecord[key],
      after: afterRecord[key],
    }));
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  lastName: "Apellido",
  email: "Correo",
  whatsappNumber: "WhatsApp",
  smsNumber: "SMS",
  reminderChannel: "Canal de recordatorios",
  phone: "Teléfono",
  dateOfBirth: "Fecha de nacimiento",
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
  typeId: "Tipo de cita",
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
  kind: "Tipo",
  policyVersion: "Versión de la política",
  acceptedAt: "Aceptado el",
  revokedAt: "Revocado el",
  holdExpiresAt: "Reserva vence",
  cancelledBy: "Cancelada por",
  patientRescheduleCount: "Reprogramaciones del paciente",
  meetingStatus: "Videollamada",
  bio: "Presentación",
  specialty: "Especialidad",
  // Field removed; stored audit rows still name it.
  professionalLicense: "Tarjeta profesional",
  publicPhone: "Teléfono público",
  publicWhatsapp: "WhatsApp público",
  meetingUrl: "Enlace de videollamada",
  patientTimezone: "Zona horaria del paciente",
  confirmedAt: "Confirmada el",
  resolvedAt: "Resuelta el",
  requestId: "Solicitud",
  portalAccessEnabled: "Acceso al portal",
  messagesStoppedAt: "Mensajes detenidos el",
  reminder: "Recordatorio",
  sendMode: "Modo de envío",
  to: "Destinatario",
  body: "Mensaje",
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
  const timezone = useDisplayTimezone();
  const action = ACTION_TYPE_CONFIG[log.actionType];
  const changes = log.fieldsBefore && log.fieldsAfter
    ? log.affectedFields.flatMap((field) => expandChange(field, log.fieldsBefore?.[field], log.fieldsAfter?.[field]))
    : [];

  return (
    <DrawerShell
      title={action?.label ?? log.actionType}
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

      {changes.length > 0 && (
        <Section title="Cambios">
          <div className="audit-changes">
            {changes.map((change) => (
              <div className="audit-change" key={change.key}>
                <div className="audit-change__field">{change.label}</div>
                <div className="audit-change__comparison">
                  <div className="audit-change__value audit-change__value--before">
                    <span className="audit-change__label">Antes</span>
                    <span>{formatValue(change.before, timezone, change.field)}</span>
                  </div>
                  <span className="audit-change__arrow" aria-hidden="true">→</span>
                  <div className="audit-change__value audit-change__value--after">
                    <span className="audit-change__label">Después</span>
                    <span>{formatValue(change.after, timezone, change.field)}</span>
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
            <Row key={key} icon={DETAIL_ICONS.note} label={fieldLabel(key)} value={formatValue(value, timezone, key)} />
          ))}
        </Section>
      )}

      {log.fieldsAfter && !log.fieldsBefore && (
        <Section title="Datos creados">
          {Object.entries(log.fieldsAfter).map(([key, value]) => (
            <Row key={key} icon={null} label={fieldLabel(key)} value={formatValue(value, timezone, key)} />
          ))}
        </Section>
      )}

      <Section title="Metadata" quiet>
        <Row icon={DETAIL_ICONS.flag} label="Fuente" value={ACTION_SOURCE_CONFIG[log.source]?.label ?? log.source} />
        {log.ipAddress && <Row icon={DETAIL_ICONS.link} label="IP" value={<span className="mono">{log.ipAddress}</span>} />}
        <Row icon={DETAIL_ICONS.id} label="Entidad ID" value={<span className="mono-sm">{log.entityId}</span>} />
      </Section>

      <Section title="Información del sistema" quiet>
        <Row icon={DETAIL_ICONS.clock} label="Fecha" value={<span className="td--dateTime">{fmtDateTimeSeconds(log.eventTimeUtc, timezone)}</span>} />
      </Section>
    </DrawerShell>
  );
}
