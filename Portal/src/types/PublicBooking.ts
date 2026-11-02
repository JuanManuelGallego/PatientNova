export interface PublicProvider {
    displayName: string;
    jobTitle: string | null;
    hasAvatar: boolean;
    hasLogo: boolean;
    timezone: string;
    /** Booking is live. While false, `types` and `locations` are empty; patients can still sign in to manage their appointments. */
    bookingOpen: boolean;
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
    /** Always null for a video call. */
    address: string | null;
    isVirtual: boolean;
}

export interface PublicSlot {
    startUtc: string;
    endUtc: string;
}

export interface PublicSlots {
    timezone: string;
    slots: PublicSlot[];
}
