import { Appointment, AppointmentType } from "./Appointment";
import { Patient } from "./Patient";

export interface Reminder {
    id: string;

    createdAt: string;
    updatedAt: string;

    channel: Channel;
    to: string;

    contentSid?: string | null;
    contentVariables?: Record<string, string> | null;

    status: ReminderStatus;
    error?: string | null;

    sendMode: ReminderMode;
    sendAt: string;
    sentAt?: string | null;
    messageId?: string | null;

    appointmentId?: string | null;
    patientId: string;

    appointment?: Appointment | null;
    patient?: Patient;
}

export type ReminderForm = {
    patientId: string;
    channel: Channel;
    message: string;
    sendAt: string;
    appointmentType?: AppointmentType;
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
    EMAIL = "EMAIL"
}

export enum ReminderMode {
    IMMEDIATE = "IMMEDIATE",
    SCHEDULED = "SCHEDULED",
}

export const CHANNEL_ICON: Record<Channel, string> = { [ Channel.WHATSAPP ]: "💬", [ Channel.SMS ]: "📱", [ Channel.EMAIL ]: "✉️" };
export const CHANNEL_LABEL: Record<Channel, string> = { [ Channel.WHATSAPP ]: "WhatsApp", [ Channel.SMS ]: "SMS", [ Channel.EMAIL ]: "Email" };

export function getChannelIcon(channel: Channel) {
    switch (channel) {
        case Channel.WHATSAPP:
            return "💬";
        case Channel.SMS:
            return "📱";
        case Channel.EMAIL:
            return "✉️";
        default:
            return "❓";
    }
}

export function getChannelLabel(channel: Channel) {
    switch (channel) {
        case Channel.WHATSAPP:
            return "WhatsApp";
        case Channel.SMS:
            return "SMS";
        case Channel.EMAIL:
            return "Email";
        default:
            return "Desconocido";
    }
}

export function getChannelIconAndLabel(channel: Channel) {
    return `${getChannelIcon(channel)} ${getChannelLabel(channel)}`;
}

export const REMINDER_STATUS_CONFIG: Record<ReminderStatus, { label: string; color: string; bg: string; dot: string }> = {
    [ ReminderStatus.CANCELLED ]: { label: "Cancelado", color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF" },
    [ ReminderStatus.FAILED ]: { label: "Fallido", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
    [ ReminderStatus.PENDING ]: { label: "Pendiente", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
    [ ReminderStatus.SENT ]: { label: "Enviado", color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E" },
    [ ReminderStatus.QUEUED ]: { label: "En cola", color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6" },
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
    ONE_HOUR_BEFORE = "1_HORA_ANTES",
    ONE_DAY_BEFORE = "1_DIA_ANTES",
    ONE_WEEK_BEFORE = "1_SEMANA_ANTES",
}

export const REMINDER_TYPE_CONFIG: Record<ReminderType, { label: string; offsetMs: number }> = {
    [ ReminderType.NONE ]: { label: "Ninguno", offsetMs: 0 },
    [ ReminderType.ONE_HOUR_BEFORE ]: { label: "1 hora antes", offsetMs: 60 * 60 * 1000 },
    [ ReminderType.ONE_DAY_BEFORE ]: { label: "1 día antes", offsetMs: 24 * 60 * 60 * 1000 },
    [ ReminderType.ONE_WEEK_BEFORE ]: { label: "1 semana antes", offsetMs: 7 * 24 * 60 * 60 * 1000 },
};

export interface FetchRemindersFilters {
    status?: ReminderStatus[],
    search?: string,
    patientId?: string,
    dateFrom?: string,
    dateTo?: string,
    page?: number,
    pageSize?: number,
    orderBy?: 'sendAt' | 'createdAt' | 'status' | 'updatedAt',
    order?: 'asc' | 'desc',
}