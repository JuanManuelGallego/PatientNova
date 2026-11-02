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
    location: { name: string; address: string | null; instructions: string | null } | null;
    /** Computed by the server; the Portal never re-derives eligibility. */
    canCancel: boolean;
    canReschedule: boolean;
}

export interface PortalRescheduleRequest {
    startUtc: string;
    patientTimezone: string;
}

export interface PortalAppointments {
    appointments: PortalAppointment[];
    consentRequired: boolean;
}
