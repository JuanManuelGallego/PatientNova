import { Appointment } from "./Appointment";
import { Patient } from "./Patient";

export interface Reminder {
  id: string;

  createdAt: string;
  updatedAt: string;

  channel: Channel;
  to: string;

  contentSid?: string | null;
  contentVariables?: Record<string, string> | null;
  body?: string | null;
  subject?: string | null;

  status: ReminderStatus;
  error?: string | null;

  sendMode: ReminderMode;
  sendAt: string;
  sentAt?: string | null;
  messageId?: string | null;
  retryCount?: number;

  appointmentId?: string | null;
  patientId: string;

  appointment?: Appointment | null;
  patient?: Patient;

  mediaUrl?: string | null;
}

export type ReminderInlineData = {
  channel: Channel;
  to: string;
  sendMode: ReminderMode;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  sendAt?: string;
  status?: ReminderStatus;
  body?: string;
  subject?: string;
};

export type ReminderForm = {
  patientId: string;
  message: string;
  sendAt: string;
  selectedTemplate: string;
  contentVariables: Record<string, string>;
  appointmentId: string;
};

export enum ReminderStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  QUEUED = "QUEUED",
}

export enum Channel {
  WHATSAPP = "WHATSAPP",
  SMS = "SMS",
  EMAIL = "EMAIL",
}

export enum ReminderMode {
  IMMEDIATE = "IMMEDIATE",
  SCHEDULED = "SCHEDULED",
}

export const CHANNEL_CFG: Record<
  Channel,
  { label: string; }
> = {
  [Channel.WHATSAPP]: { label: "WhatsApp"  },
  [Channel.SMS]: { label: "SMS" },
  [Channel.EMAIL]: { label: "Email" },
};

export const REMINDER_STATUS_CONFIG: Record<
  ReminderStatus,
  { label: string; color: string; bg: string }
> = {
  [ReminderStatus.CANCELLED]: {
    label: "Cancelado",
    color: "#6B7280",
    bg: "#F3F4F6",
  },
  [ReminderStatus.FAILED]: {
    label: "Fallido",
    color: "#DC2626",
    bg: "#FEF2F2",
  },
  [ReminderStatus.PENDING]: {
    label: "Pendiente",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  [ReminderStatus.SENT]: {
    label: "Enviado",
    color: "#16A34A",
    bg: "#F0FDF4",
  },
  [ReminderStatus.QUEUED]: {
    label: "En cola",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
};

export interface ScheduledReminderJob {
  id: string;
  channel: Channel;
  to: string | null;
  sentAt: string;
  sendAt: string;
  status: ReminderStatus;
  messageSid?: string;
  error?: string;
}

export interface BulkRemindersResult {
  patientId: string;
  name: string;
  channel: Channel;
  status: "ok" | "error" | "skipped";
  reason?: string;
}

export enum ReminderType {
  NONE = "NINGUNO",
  IMMEDIATE = "IMMEDIATE",
  ONE_HOUR_BEFORE = "1_HORA_ANTES",
  ONE_DAY_BEFORE = "1_DIA_ANTES",
  SAME_DAY_MORNING = "MANANA_DEL_DIA",
  PREVIOUS_DAY_MORNING = "MANANA_DIA_ANTES",
  PREVIOUS_DAY_EVENING = "TARDE_DIA_ANTES",
  MANUAL = "MANUAL",
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ClockReminder {
  daysBefore: number;
  hour: number;
  minute: number;
}

export const REMINDER_TYPE_CONFIG: Record<
  ReminderType,
  { label: string; offsetMs: number; clock?: ClockReminder }
> = {
  [ReminderType.NONE]: { label: "Ninguno", offsetMs: 0 },
  [ReminderType.MANUAL]: { label: "Manual (elegir fecha y hora)", offsetMs: 0 },
  [ReminderType.IMMEDIATE]: { label: "Enviar ahora", offsetMs: 0 },
  [ReminderType.ONE_HOUR_BEFORE]: { label: "1 hora antes", offsetMs: HOUR_MS },
  [ReminderType.ONE_DAY_BEFORE]: { label: "1 día antes", offsetMs: DAY_MS },
  [ReminderType.SAME_DAY_MORNING]: {
    label: "Mañana del día de la cita",
    offsetMs: 0,
    clock: { daysBefore: 0, hour: 8, minute: 0 },
  },
  [ReminderType.PREVIOUS_DAY_MORNING]: {
    label: "Mañana del día anterior",
    offsetMs: 0,
    clock: { daysBefore: 1, hour: 9, minute: 0 },
  },
  [ReminderType.PREVIOUS_DAY_EVENING]: {
    label: "Tarde del día anterior",
    offsetMs: 0,
    clock: { daysBefore: 1, hour: 18, minute: 0 },
  },
};

export const RELATIVE_REMINDER_TYPES: ReminderType[] = [
  ReminderType.ONE_HOUR_BEFORE,
  ReminderType.ONE_DAY_BEFORE,
];

export interface FetchRemindersFilters {
  status?: ReminderStatus[];
  search?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "sendAt" | "createdAt" | "status" | "updatedAt";
  order?: "asc" | "desc";
}

export const MAX_RETRIES = 1

export const CLOCK_REMINDER_TYPES: ReminderType[] = [
  ReminderType.SAME_DAY_MORNING,
  ReminderType.PREVIOUS_DAY_MORNING,
  ReminderType.PREVIOUS_DAY_EVENING,
];
