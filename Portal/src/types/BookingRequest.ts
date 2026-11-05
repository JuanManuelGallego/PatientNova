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
    /** How the patient proved who they are: `email`, or `verifiedPhone` on this channel. */
    contactChannel: "EMAIL" | "WHATSAPP" | "SMS";
    email: string | null;
    verifiedPhone: string | null;
    /** Typed in the booking form, never proven. */
    phone: string | null;
    patientTimezone: string;
    appointmentId: string | null;
    patientId: string | null;
    type: { id: string; name: string };
    location: { id: string; name: string; isVirtual: boolean };
}

/** A patient of the provider sharing the request's verified contact, computed when the request is opened. */
export interface RequestCandidate {
    id: string;
    name: string;
    lastName: string;
    email: string | null;
    whatsappNumber: string | null;
    smsNumber: string | null;
    whatsappUnverified: boolean;
    /** The match is only a number typed in the booking form, so it proves nothing about this record. */
    unverifiedMatch: boolean;
    status: "ACTIVE" | "INACTIVE";
    portalAccessEnabled: boolean;
    isDeleted: boolean;
    deletedAt: string | null;
    createdAt: string;
    lastVisitAt: string | null;
}

export interface BookingRequestDetail extends BookingRequest {
    consent: { policyVersion: string; acceptedAt: string };
    /** Active records first (at most one for an email, several for a shared number), then deleted ones. */
    candidates: RequestCandidate[];
}

export interface ApproveBookingRequestBody {
    existingPatientId?: string;
    restorePatientId?: string;
}

export const REQUEST_STATUS_LABELS: Record<BookingRequestStatus, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    EXPIRED: "Vencida",
    CANCELLED: "Cancelada por el paciente",
};
