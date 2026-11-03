export type BookingRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type BookingRequestKind = "NEW" | "REVIEW";
export type BookingRequestTab = "pending" | "resolved" | "expired";

/** Provider inbox row. `status` is effective: a pending request past its hold reads EXPIRED. */
export interface BookingRequest {
    id: string;
    kind: BookingRequestKind;
    status: BookingRequestStatus;
    createdAt: string;
    startAt: string;
    endAt: string;
    holdExpiresAt: string;
    resolvedAt: string | null;
    name: string;
    lastName: string;
    email: string;
    phone: string | null;
    patientTimezone: string;
    appointmentId: string | null;
    patientId: string | null;
    type: { id: string; name: string };
    location: { id: string; name: string; isVirtual: boolean };
}

/** A patient of the provider sharing the request's email, computed when the request is opened. */
export interface RequestCandidate {
    id: string;
    name: string;
    lastName: string;
    email: string | null;
    whatsappNumber: string | null;
    status: "ACTIVE" | "INACTIVE";
    portalAccessEnabled: boolean;
    isDeleted: boolean;
    deletedAt: string | null;
    createdAt: string;
    lastVisitAt: string | null;
}

export interface BookingRequestDetail extends BookingRequest {
    consent: { policyVersion: string; acceptedAt: string };
    /** The active record first (at most one), then deleted ones. */
    candidates: RequestCandidate[];
}

export interface ApproveBookingRequestBody {
    restorePatientId?: string;
}

export const REQUEST_STATUS_LABELS: Record<BookingRequestStatus, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    EXPIRED: "Vencida",
    CANCELLED: "Cancelada por el paciente",
};
