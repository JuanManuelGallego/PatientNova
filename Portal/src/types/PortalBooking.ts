export interface PortalBookingRequest {
    typeId: string;
    locationId: string;
    startUtc: string;
    patientTimezone: string;
    consentAccepted: true;
    patient: { name: string; lastName: string; phone?: string };
}

export interface PortalAppointment {
    id: string;
    startUtc: string;
    endUtc: string;
    durationMinutes: number;
    status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    price: number;
    type: { name: string } | null;
    location: { name: string; address: string | null; instructions: string | null; isVirtual: boolean } | null;
    meeting: { status: "ready"; url: string } | { status: "pending" } | null;
    /** Computed by the server; the Portal never re-derives eligibility. */
    canCancel: boolean;
    canReschedule: boolean;
}

/** A booking awaiting the provider's approval (approval mode). It holds the slot until `holdExpiresAt`. */
export interface PortalPendingRequest {
    id: string;
    status: "PENDING";
    startUtc: string;
    endUtc: string;
    durationMinutes: number;
    holdExpiresAt: string;
    type: { name: string };
    location: { name: string; address: string | null; isVirtual: boolean };
}

/** Auto-confirm creates an appointment (201); approval mode creates a request for the provider to review (202). */
export type PortalBookingOutcome = { appointment: PortalAppointment } | { request: PortalPendingRequest };

export interface PortalRescheduleRequest {
    startUtc: string;
    patientTimezone: string;
}

export interface PortalAppointments {
    appointments: PortalAppointment[];
    requests: PortalPendingRequest[];
    consentRequired: boolean;
}
