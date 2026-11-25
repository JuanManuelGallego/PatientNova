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
  PATIENT_TYPE = "PATIENT_TYPE",
  GOOGLE_CONNECTION = "GOOGLE_CONNECTION",
  GOOGLE_MEET_SPACE = "GOOGLE_MEET_SPACE",
  BOOKING_REQUEST = "BOOKING_REQUEST",
  PATIENT_CONSENT = "PATIENT_CONSENT",
}

export enum ActionType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  RESTORE = "RESTORE",
  LOGIN = "LOGIN",
  SEND = "SEND",
}

export enum ActionSource {
  API = "API",
  JOB = "JOB",
  PUBLIC_PORTAL = "PUBLIC_PORTAL",
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
  ipAddress: string | null;
}

export interface FetchAuditLogsFilters {
  entityType?: EntityType | EntityType[];
  entityId?: string;
  actionType?: ActionType | ActionType[];
  source?: ActionSource | ActionSource[];
  portalPatientId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "eventTimeUtc" | "entityType" | "actionType" | "source" | "actorId";
  order?: "asc" | "desc";
}
export const ENTITY_TYPE_CONFIG: Record<
  EntityType,
  { label: string; color: string; bg: string }
> = {
  [EntityType.USER]: { label: "Usuario", color: "#7C3AED", bg: "#F5F3FF" },          
  [EntityType.APPOINTMENT]: { label: "Cita", color: "#4F46E5", bg: "#EEF2FF" },           
  [EntityType.PATIENT]: { label: "Paciente", color: "#0891B2", bg: "#ECFEFF" },     
  [EntityType.REMINDER]: { label: "Recordatorio", color: "#DB2777", bg: "#FDF2F8" },
  [EntityType.MEDICAL_RECORD]: { label: "Historia clínica", color: "#C026D3", bg: "#FDF4FF" },
  [EntityType.APPOINTMENT_TYPE]: { label: "Tipo de cita", color: "#4D7C0F", bg: "#F7FEE7" },  
  [EntityType.APPOINTMENT_LOCATION]: { label: "Ubicación", color: "#0D9488", bg: "#F0FDFA" }, 
  [EntityType.BLOCKED_TIME]: { label: "Tiempo bloqueado", color: "#4B5563", bg: "#F9FAFB" },
  [EntityType.CONSENT_DOCUMENT]: { label: "Consentimiento", color: "#475569", bg: "#F8FAFC" },
  [EntityType.PATIENT_TYPE]: { label: "Tipo de paciente", color: "#9333EA", bg: "#FAF5FF" },
  [EntityType.GOOGLE_CONNECTION]: { label: "Conexión de Google", color: "#2563EB", bg: "#EFF6FF" },
  [EntityType.GOOGLE_MEET_SPACE]: { label: "Sala Google Meet", color: "#0891B2", bg: "#ECFEFF" },
  [EntityType.BOOKING_REQUEST]: { label: "Solicitud de reserva", color: "#B45309", bg: "#FFFBEB" },
  [EntityType.PATIENT_CONSENT]: { label: "Consentimiento", color: "#334155", bg: "#F1F5F9" },
};

export const UNKNOWN_PILL_STYLE = { color: "#4B5563", bg: "#F3F4F6" } as const;

export const ACTION_TYPE_CONFIG: Record<ActionType, { label: string; color: string }> = {
  [ActionType.CREATE]: { label: "Creación", color: "#059669" },
  [ActionType.UPDATE]: { label: "Actualización", color: "#0284C7" },
  [ActionType.DELETE]: { label: "Eliminación", color: "#E11D48" },
  [ActionType.RESTORE]: { label: "Restauración", color: "#0D9488" },
  [ActionType.LOGIN]: { label: "Inicio de sesión", color: "#6366F1" },
  [ActionType.SEND]: { label: "Envío", color: "#D97706" },
};

export const actionTypeLabel = (action: ActionType): string => ACTION_TYPE_CONFIG[action]?.label ?? action;

export const entityTypeLabel = (entityType: EntityType): string => ENTITY_TYPE_CONFIG[entityType]?.label ?? entityType;

export const ACTION_SOURCE_CONFIG: Record<
  ActionSource,
  { label: string }
> = {
  [ActionSource.API]: { label: "Tú" },
  [ActionSource.JOB]: { label: "Tarea" },
  [ActionSource.PUBLIC_PORTAL]: { label: "Portal de pacientes" },
};
