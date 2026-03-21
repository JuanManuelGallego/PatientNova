import { PatientStatus } from './Patient';
import { AppointmentStatus } from './Appointment';
import { Channel, ReminderStatus } from './Reminder';
export interface ApiPaginatedResponse {
    success: boolean;
    data: {
        data: unknown;
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
    timestamp: string;
}

export interface ApiResponse {
    success: boolean;
    data: unknown;
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
    };
    byChannel: {
        [ Channel.WHATSAPP ]: number;
        [ Channel.SMS ]: number;
        [ Channel.EMAIL ]: number;
    };
}

export const API_BASE = "http://localhost:3001";
