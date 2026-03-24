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

    location: string;
    meetingUrl?: string | null;
    notes?: string | null;
    type: AppointmentType;

    status: AppointmentStatus;
    confirmedAt?: string | null;
    cancelledAt?: string | null;
    completedAt?: string | null;

    patientId: string;
    reminderId?: string | null;

    patient: Patient;
    reminder?: Reminder | null;
}

export interface AppointmentForm {
    startAt: string;
    duration: string;
    price: number;
    paid: AppointmentPaidStatus;
    location: string;
    meetingUrl?: string;
    notes?: string;
    type: AppointmentType;
    status: AppointmentStatus;
    patientId: string;
    reminderId?: string;
    reminderType: ReminderType;
}

export enum AppointmentStatus {
    SCHEDULED = "SCHEDULED",
    CONFIRMED = "CONFIRMED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    NO_SHOW = "NO_SHOW"
}

export enum AppointmentType {
    INDIVIDUAL = 'INDIVIDUAL',
    KID = 'KID',
    COUPLE = 'COUPLE',
    FAMILY = 'FAMILY',
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

export const APPT_TYPE_CFG: Record<AppointmentType, { label: string; price: number; duration: AppointmentDuration }> = {
    [ AppointmentType.KID ]: { label: "Niño", price: 115000, duration: AppointmentDuration.MIN_60 },
    [ AppointmentType.INDIVIDUAL ]: { label: "Individual", price: 115000, duration: AppointmentDuration.MIN_60 },
    [ AppointmentType.COUPLE ]: { label: "Pareja", price: 220000, duration: AppointmentDuration.MIN_60 },
    [ AppointmentType.FAMILY ]: { label: "Familia", price: 220000, duration: AppointmentDuration.MIN_60 },
}

export const APPT_STATUS_CFG: Record<AppointmentStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
    [ AppointmentStatus.SCHEDULED ]: { label: "Programada", color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6", icon: "🗓️" },
    [ AppointmentStatus.CONFIRMED ]: { label: "Confirmada", color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E", icon: "✅" },
    [ AppointmentStatus.COMPLETED ]: { label: "Completada", color: "#7C3AED", bg: "#F5F3FF", dot: "#8B5CF6", icon: "🏁" },
    [ AppointmentStatus.CANCELLED ]: { label: "Cancelada", color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF", icon: "✖️" },
    [ AppointmentStatus.NO_SHOW ]: { label: "No asistió", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444", icon: "🚫" },
};

export const APPOINTMENT_LOCATIONS: string[] = [
    "ACTA",
    "Sentido y Realidad",
    "Vamos a Terapia",
    "Virtual", ]

export const APT_LOCATION_CFG: Record<string, { label: string; color: string; bg: string; dot: string; icon: string }> = {
    [ "ACTA" ]: { label: "ACTA", color: "#ab63e6", bg: "#ecc4ffa8", dot: "#3B82F6", icon: "🏛️" },
    [ "Sentido y Realidad" ]: { label: "Sentido y Realidad", color: "#30b493", bg: "#9debb57e", dot: "#22C55E", icon: "🌱" },
    [ "Vamos a Terapia" ]: { label: "Vamos a Terapia", color: "#399efc", bg: "#c7e8fe", dot: "#fbbf24", icon: "🏢" },
    [ "Virtual" ]: { label: "Virtual", color: "#f56d73", bg: "#FEF2F2", dot: "#EF4444", icon: "💻" },
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