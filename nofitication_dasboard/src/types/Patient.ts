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
    avatar: string;
    createdAt: string;
    email: string;
    id: string;
    lastName: string;
    name: string;
    smsNumber: string | null;
    status: PatientStatus;
    updatedAt: string;
    whatsappNumber: string | null;
}
