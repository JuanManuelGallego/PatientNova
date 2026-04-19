import { Appointment } from "./Appointment";
import { MedicalRecord } from "./MedicalRecord";
import { Reminder } from "./Reminder";

export enum PatientStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    ARCHIVED = "ARCHIVED"
}

export const PATIENT_STATUS_CONFIG: Record<PatientStatus, { label: string; color: string; bg: string, icon: string }> = {
    ACTIVE: { label: "Activo", color: "#16A34A", bg: "#F0FDF4", icon: "✅" },
    INACTIVE: { label: "Inactivo", color: "#D97706", bg: "#FFFBEB", icon: "⚠️" },
    ARCHIVED: { label: "Archivado", color: "#df4429", bg: "#f541412f", icon: "🗃️" },
};

export interface Patient {
    id: string;

    name: string;
    lastName: string;

    whatsappNumber?: string | null;
    smsNumber?: string | null;
    email?: string | null;

    dateOfBirth?: string | null;
    notes?: string | null;

    status: PatientStatus;
    archivedAt?: string | null;
    createdAt: string;
    updatedAt: string;

    appointments?: Appointment[];
    reminders?: Reminder[];
    medicalRecord?: MedicalRecord
}

export interface FetchPatientsFilters {
    status?: string | string[];
    search?: string;
    page?: number;
    pageSize?: number;
    orderBy?: 'name' | 'lastName' | 'email' | 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
    from?: string;
    to?: string;
}
