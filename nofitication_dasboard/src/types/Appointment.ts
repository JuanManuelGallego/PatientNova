import { Patient } from "./Patient";
import { Reminder, ReminderType } from "./Reminder";

export interface Appointment {
    id: string;

    createdAt: Date;
    updatedAt: Date;

    startAt: Date;
    endAt: Date;
    timezone: string;

    price: number;
    currency: string;
    paid: boolean;

    location: string;
    meetingUrl?: string | null;
    notes?: string | null;
    type: string;

    status: AppointmentStatus;
    confirmedAt?: Date | null;
    cancelledAt?: Date | null;
    completedAt?: Date | null;

    patientId: string;
    reminderId?: string | null;

    patient: Patient;
    reminder?: Reminder | null;
}

export interface AppointmentForm {
    startAt: Date;
    duration: string;
    location: string;
    meetingUrl?: string;
    notes?: string;
    patientId: string;
    paid: boolean;
    price: string;
    reminderId?: string;
    reminderType: ReminderType;
    status: AppointmentStatus;
    type: string;
}

export enum AppointmentStatus {
    SCHEDULED = "SCHEDULED",
    CONFIRMED = "CONFIRMED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    NO_SHOW = "NO_SHOW"
}

export enum AppointmentName {
    INDIVIDUAL = 'Individual',
    KID = 'Niño',
    COUPLE = 'Pareja',
    FAMILY = 'Familia',
}

export enum AppointmentDuration {
    MIN_45 = '45 min',
    MIN_50 = '50 min',
    MIN_60 = '1 h',
    MIN_90 = '90 min',
}

export interface AppointmentType {
    id: string;
    name: AppointmentName;
    price: string;
    duration: AppointmentDuration;
}

export const APPOINTMENT_TYPES: AppointmentType[] = [
    { id: "1", name: AppointmentName.KID, price: "115000", duration: AppointmentDuration.MIN_60 },
    { id: "2", name: AppointmentName.INDIVIDUAL, price: "115000", duration: AppointmentDuration.MIN_60 },
    { id: "3", name: AppointmentName.COUPLE, price: "220000", duration: AppointmentDuration.MIN_60 },
    { id: "4", name: AppointmentName.FAMILY, price: "220000", duration: AppointmentDuration.MIN_60 },
];

export const STATUS_CFG: Record<AppointmentStatus, { label: string; color: string; bg: string; dot: string; icon: string }> = {
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

export const LOCATION_CFG: Record<string, { label: string; color: string; bg: string; dot: string; icon: string }> = {
    [ "ACTA" ]: { label: "ACTA", color: "#ab63e6", bg: "#ecc4ffa8", dot: "#3B82F6", icon: "🏛️" },
    [ "Sentido y Realidad" ]: { label: "Sentido y Realidad", color: "#30b493", bg: "#9debb57e", dot: "#22C55E", icon: "🌱" },
    [ "Vamos a Terapia" ]: { label: "Vamos a Terapia", color: "#399efc", bg: "#c7e8fe", dot: "#fbbf24", icon: "🏢" },
    [ "Virtual" ]: { label: "Virtual", color: "#f56d73", bg: "#FEF2F2", dot: "#EF4444", icon: "�" },
};
