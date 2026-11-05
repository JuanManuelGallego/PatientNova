export type LoginChannel = "EMAIL" | "WHATSAPP";

export interface PublicProvider {
    displayName: string;
    jobTitle: string | null;
    specialty: string | null;
    professionalLicense: string | null;
    bio: string | null;
    phone: string | null;
    whatsapp: string | null;
    hasAvatar: boolean;
    hasLogo: boolean;
    timezone: string;
    bookingOpen: boolean;
    approvalRequired: boolean;
    /** Absent from an API older than the Portal, which means email only. */
    loginChannels?: LoginChannel[];
    reschedulePolicy: ReschedulePolicy | null;
    lastBookableDate: string;
    types: PublicAppointmentType[];
    locations: PublicLocation[];
}

export interface ReschedulePolicy {
    maxReschedules: number;
    minNoticeHours: number;
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
