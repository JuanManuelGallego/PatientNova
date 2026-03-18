export interface Reminder {
    channel: Channel;
    contentSid?: string;
    contentVariables?: Record<string, string>;
    createdAt: string;
    error?: string;
    id: string;
    messageId?: string;
    mode: ReminderMode;
    scheduledAt?: string;
    sendAt: string;
    status: ReminderStatus;
    to: string;
    updatedAt: string;
    patientId?: string;
}

export enum ReminderStatus {
    PENDING = "PENDING",
    SENT = "SENT",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
}

export enum Channel {
    WHATSAPP = "WHATSAPP",
    SMS = "SMS",
    EMAIL = "EMAIL"
}

export enum ReminderMode {
    NOW = "IMMEDIATE",
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
};

export interface ScheduledReminderJob {
    id: string;
    channel: Channel;
    to: string | null;
    sendAt: string;
    scheduledAt: string;
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