export type BookingApprovalMode = "AUTO_CONFIRM" | "REQUIRE_APPROVAL";

export interface BookingReadiness {
    hasSlug: boolean;
    hasAvailability: boolean;
    hasBookableType: boolean;
    hasBookableLocation: boolean;
}

export interface BookingSettings {
    timezone: string;
    bookingSlug: string | null;
    bookingUrl: string | null;
    bookingEnabled: boolean;
    bookingApprovalMode: BookingApprovalMode;
    slotIntervalMinutes: number;
    bufferMinutes: number;
    minLeadMinutes: number;
    maxHorizonDays: number;
    readiness: BookingReadiness;
    /** Enabled and ready: the public link accepts bookings. Enabled-but-not-live happens when setup is undone later. */
    live: boolean;
}

export type BookingSettingsUpdate = Partial<Pick<BookingSettings,
    "bookingSlug" | "bookingEnabled" | "slotIntervalMinutes" | "bufferMinutes" | "minLeadMinutes" | "maxHorizonDays">>;

/** One weekly window; minutes are wall-clock in the provider's timezone, half-open [start, end). */
export interface AvailabilityRule {
    /** ISO weekday: 1 = lunes ... 7 = domingo. */
    weekday: number;
    startMinute: number;
    endMinute: number;
}

export interface Availability {
    timezone: string;
    rules: AvailabilityRule[];
}

/** Mirrors the server (`Server/src/booking-settings/booking-settings.schemas.ts`). */
export const MAX_AVAILABILITY_RULES = 50;

/** Mirrors the server (`Server/src/booking-settings/booking-settings.schemas.ts`). */
export const SLOT_INTERVAL_OPTIONS = [ 5, 10, 15, 20, 30, 45, 60, 90, 120 ] as const;
