export enum Channel {
    WHATSAPP = "whatsapp",
    SMS = "sms",
    EMAIL = "email"
}

export const CHANNEL_ICON: Record<Channel, string> = { [Channel.WHATSAPP]: "💬", [Channel.SMS]: "📱", [Channel.EMAIL]: "✉️" };
export const CHANNEL_LABEL: Record<Channel, string> = { [Channel.WHATSAPP]: "WhatsApp", [Channel.SMS]: "SMS", [Channel.EMAIL]: "Email" };

export type ReminderStatus = "scheduled" | "sent" | "failed" | "pending" | "canceled";

export const REMINDER_STATUS_CONFIG: Record<ReminderStatus, { label: string; color: string; bg: string; dot: string }> = {
    canceled: { label: "Cancelado", color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF" },
    failed: { label: "Fallido", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
    pending: { label: "Pendiente", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
    scheduled: { label: "Programado", color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6" },
    sent: { label: "Enviado", color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E" },
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
