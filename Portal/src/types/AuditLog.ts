export enum EntityType {
  USER = "USER",
  APPOINTMENT = "APPOINTMENT",
  PATIENT = "PATIENT",
  REMINDER = "REMINDER",
  MEDICAL_RECORD = "MEDICAL_RECORD",
  APPOINTMENT_TYPE = "APPOINTMENT_TYPE",
  APPOINTMENT_LOCATION = "APPOINTMENT_LOCATION",
  BLOCKED_TIME = "BLOCKED_TIME",
  CONSENT_DOCUMENT = "CONSENT_DOCUMENT",
}

export enum ActionType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  RESTORE = "RESTORE",
}

export enum ActionSource {
  API = "API",
  ADMIN_PANEL = "ADMIN_PANEL",
  JOB = "JOB",
  MIGRATION = "MIGRATION",
}

export interface AuditLog {
  id: string;
  userId: string | null;
  actorId: string;
  actorDisplayName: string;
  eventTimeUtc: string;
  entityType: EntityType;
  entityId: string;
  actionType: ActionType;
  source: ActionSource;
  description: string;
  affectedFields: string[];
  fieldsBefore: Record<string, unknown> | null;
  fieldsAfter: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
}

export interface FetchAuditLogsFilters {
  entityType?: EntityType;
  actionType?: ActionType;
  source?: ActionSource;
  page?: number;
  pageSize?: number;
  orderBy?: "eventTimeUtc" | "entityType" | "actionType" | "source" | "actorId";
  order?: "asc" | "desc";
}

export const ENTITY_TYPE_CONFIG: Record<
  EntityType,
  { label: string; color: string }
> = {
  [EntityType.USER]: { label: "Usuario", color: "#7C3AED" },
  [EntityType.APPOINTMENT]: { label: "Cita", color: "#2563EB" },
  [EntityType.PATIENT]: { label: "Paciente", color: "#059669" },
  [EntityType.REMINDER]: { label: "Recordatorio", color: "#D97706" },
  [EntityType.MEDICAL_RECORD]: { label: "Historia Clinica", color: "#DC2626" },
  [EntityType.APPOINTMENT_TYPE]: { label: "Tipo de Cita", color: "#7C3AED" },
  [EntityType.APPOINTMENT_LOCATION]: { label: "Ubicacion", color: "#0891B2" },
  [EntityType.BLOCKED_TIME]: { label: "Tiempo Bloqueado", color: "#6B7280" },
  [EntityType.CONSENT_DOCUMENT]: { label: "Consentimiento", color: "#4F46E5" },
};

export const ACTION_TYPE_CONFIG: Record<
  ActionType,
  { label: string; color: string; bg: string }
> = {
  [ActionType.CREATE]: { label: "Creación", color: "#059669", bg: "#F0FDF4" },
  [ActionType.UPDATE]: { label: "Actualización", color: "#2563EB", bg: "#EFF6FF" },
  [ActionType.DELETE]: { label: "Eliminación", color: "#DC2626", bg: "#FEF2F2" },
  [ActionType.RESTORE]: { label: "Restauración", color: "#D97706", bg: "#FFFBEB" },
};

export const ACTION_SOURCE_CONFIG: Record<
  ActionSource,
  { label: string }
> = {
  [ActionSource.API]: { label: "API" },
  [ActionSource.ADMIN_PANEL]: { label: "Panel Admin" },
  [ActionSource.JOB]: { label: "Tarea" },
  [ActionSource.MIGRATION]: { label: "Migracion" },
};
