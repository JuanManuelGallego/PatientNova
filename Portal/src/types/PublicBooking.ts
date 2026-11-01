export interface PublicProvider {
    displayName: string;
    jobTitle: string | null;
    hasAvatar: boolean;
    hasLogo: boolean;
    timezone: string;
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

export interface PublicSlots {
    timezone: string;
    slots: PublicSlot[];
}
