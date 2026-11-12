export type BookingContactChoice = { channel: "EMAIL"; email: string } | { channel: "WHATSAPP"; phone: string };

export interface StartBookingRequest {
    typeId: string;
    locationId: string;
    startUtc: string;
    patientTimezone: string;
    consentAccepted: true;
    captchaToken: string;
    patient: { name: string; lastName: string; phone?: string };
    contact: BookingContactChoice;
}

export interface BookingPending {
    channel: "EMAIL" | "WHATSAPP";
    contact: string;
    startUtc: string;
    holdExpiresAt: string;
    approvalRequired: boolean;
    releaseToken: string;
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

export interface PortalRescheduleRequest {
    startUtc: string;
    patientTimezone: string;
}

export interface PortalAppointments {
    appointments: PortalAppointment[];
    requests: PortalPendingRequest[];
    consentRequired: boolean;
}
