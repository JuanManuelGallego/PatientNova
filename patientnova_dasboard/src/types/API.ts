import { PatientStatus } from './Patient';
import { AppointmentStatus } from './Appointment';
import { Channel, ReminderStatus } from './Reminder';

export interface ApiPaginatedResponse<T = unknown> {
    success: boolean;
    data: {
        data: T[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
    timestamp: string;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data: T;
    timestamp: string;
}

export interface ApiErrorResponse<T = unknown> {
    success: boolean;
    error: T;
    timestamp: string;
}

export interface PatientStats {
    total: number;
    byStatus: {
        [ PatientStatus.ACTIVE ]: number;
        [ PatientStatus.INACTIVE ]: number;
        [ PatientStatus.ARCHIVED ]: number;
    };
}

export interface AppointmentStats {
    total: number,
    todayCount: number;
    byStatus: {
        [ AppointmentStatus.SCHEDULED ]: number,
        [ AppointmentStatus.CONFIRMED ]: number,
        [ AppointmentStatus.COMPLETED ]: number,
        [ AppointmentStatus.CANCELLED ]: number,
        [ AppointmentStatus.NO_SHOW ]: number
    },
    totalRevenue: number,
    paidRevenue: number,
    unpaidRevenue: number,
    unpaidCount: number
}

export interface ReminderStats {
    total: number;
    todayCount: number;
    byStatus: {
        [ ReminderStatus.PENDING ]: number;
        [ ReminderStatus.SENT ]: number;
        [ ReminderStatus.FAILED ]: number;
        [ ReminderStatus.CANCELLED ]: number;
        [ ReminderStatus.QUEUED ]: number;
    };
    byChannel: {
        [ Channel.WHATSAPP ]: number;
        [ Channel.SMS ]: number;
        [ Channel.EMAIL ]: number;
    };
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";