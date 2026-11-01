/** `GET /v1/public/providers/:slug` (allow-listed public profile). */
export interface PublicProvider {
    displayName: string;
    jobTitle: string | null;
    hasAvatar: boolean;
    hasLogo: boolean;
    timezone: string;
    /** Last local date (YYYY-MM-DD) inside the booking horizon. */
    lastBookableDate: string;
    types: PublicAppointmentType[];
    locations: PublicLocation[];
}

export interface PublicAppointmentType {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: number | null;
}

export interface PublicLocation {
    id: string;
    name: string;
    address: string | null;
}

export interface PublicSlot {
    startUtc: string;
    endUtc: string;
}

/** `GET /v1/public/providers/:slug/slots`. */
export interface PublicSlots {
    timezone: string;
    slots: PublicSlot[];
}
