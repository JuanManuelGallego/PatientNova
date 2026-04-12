import { Patient } from "./Patient";
import { Reminder, ReminderType } from "./Reminder";

export interface Appointment {
    id: string;

    createdAt: string;
    updatedAt: string;

    startAt: string;
    endAt: string;
    timezone: string;

    price: number;
    currency: string;
    paid: boolean;

    meetingUrl?: string | null;
    notes?: string | null;

    status: AppointmentStatus;
    confirmedAt?: string | null;
    cancelledAt?: string | null;
    completedAt?: string | null;

    patientId: string;
    reminderId?: string | null;
    locationId?: string | null;
    typeId?: string | null;

    patient: Patient;
    reminder?: Reminder | null;
    appointmentLocation: AppointmentLocation;
    appointmentType: AppointmentType;
}

export interface AppointmentForm {
    startAt: string;
    duration: string;
    price: number;
    paid: AppointmentPaidStatus;
    locationId: string;
    meetingUrl?: string;
    notes?: string;
    typeId: string;
    status: AppointmentStatus;
    patientId: string;
    reminderId?: string;
    reminderType: ReminderType;
}

export enum AppointmentDuration {
    MIN_45 = '45 min',
    MIN_50 = '50 min',
    MIN_60 = '1 h',
    MIN_90 = '90 min',
}

export enum AppointmentPaidStatus {
    PAID = 'PAID',
    UNPAID = 'UNPAID',
}

export const APPT_PAID_STATUS_CFG: Record<AppointmentPaidStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
    [ AppointmentPaidStatus.PAID ]: { label: "Pagado", color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E", icon: "💳" },
    [ AppointmentPaidStatus.UNPAID ]: { label: "Pendiente", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444", icon: "⏳" },
};

export enum AppointmentStatus {
    SCHEDULED = "SCHEDULED",
    CONFIRMED = "CONFIRMED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    NO_SHOW = "NO_SHOW"
}

export const APPT_STATUS_CFG: Record<AppointmentStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
    [ AppointmentStatus.SCHEDULED ]: { label: "Programada", color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6", icon: "🗓️" },
    [ AppointmentStatus.CONFIRMED ]: { label: "Confirmada", color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E", icon: "✅" },
    [ AppointmentStatus.COMPLETED ]: { label: "Completada", color: "#7C3AED", bg: "#F5F3FF", dot: "#8B5CF6", icon: "🏁" },
    [ AppointmentStatus.CANCELLED ]: { label: "Cancelada", color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF", icon: "✖️" },
    [ AppointmentStatus.NO_SHOW ]: { label: "No asistió", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444", icon: "🚫" },
};

export interface FetchAppointmentsFilters {
    patientId?: string;
    status?: AppointmentStatus;
    startAt?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    paid?: boolean;
    page?: number;
    pageSize?: number;
    orderBy?: 'startAt' | 'createdAt' | 'status' | 'price' | 'location' | 'type' | 'patientName';
    order?: 'asc' | 'desc';
}

export const REMINDER_TEMPLATE = "Asunto: Recordatorio de cita médica - Dra. Manuela Cardona\nBuen día!\nLe escribimos para recordarle su próxima cita con la Dra. Manuela Cardona:\nFecha: {{1}}\nHora: {{2}}\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\nQuedamos a su disposición para cualquier duda. ¡Feliz día!"

export interface AppointmentLocation {
    id: string;
    name: string;
    address?: string | null;
    meetingUrl?: string | null;
    color?: string | null;
    bg?: string | null;
    dot?: string | null;
    icon?: string | null;
    isVirtual: boolean;
    isActive: boolean;
}

export interface AppointmentType {
    id: string;
    name: string;
    description?: string | null;
    defaultDuration: number;
    defaultPrice?: number | null;
    color?: string | null;
    icon?: string | null;
    isActive: boolean;
}