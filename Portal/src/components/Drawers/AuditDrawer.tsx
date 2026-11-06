import {
  AuditLog,
  ACTION_TYPE_CONFIG,
  ACTION_SOURCE_CONFIG,
} from "@/src/types/AuditLog";
import { calendarDayOf, fmtCalendarDay, fmtDateTime } from "@/src/utils/TimeUtils";
import { DrawerShell, Section, Row } from "./DrawerUtils";
import { DETAIL_ICONS } from "@/src/config/icons";
import { EntityTypePill } from "../Info/EntityTypePill";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";

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
};

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
  kind: "Tipo",
  policyVersion: "Versión de la política",
  acceptedAt: "Aceptado el",
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

      {log.fieldsBefore && log.fieldsAfter && (
        <Section title="Cambios">
          <div className="audit-changes">
            {log.affectedFields.map((field) => (
              <div className="audit-change" key={field}>
                <div className="audit-change__field">{fieldLabel(field)}</div>
                <div className="audit-change__comparison">
                  <div className="audit-change__value audit-change__value--before">
                    <span className="audit-change__label">Antes</span>
                    <span>{formatValue(log.fieldsBefore?.[field], timezone, field)}</span>
                  </div>
                  <span className="audit-change__arrow" aria-hidden="true">→</span>
                  <div className="audit-change__value audit-change__value--after">
                    <span className="audit-change__label">Después</span>
                    <span>{formatValue(log.fieldsAfter?.[field], timezone, field)}</span>
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
        <Row icon={DETAIL_ICONS.clock} label="Fecha" value={<span className="td--dateTime">{fmtDateTime(log.eventTimeUtc, timezone)}</span>} />
      </Section>
    </DrawerShell>
  );
}
