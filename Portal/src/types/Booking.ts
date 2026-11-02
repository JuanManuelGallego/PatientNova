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
    /** Portal reschedules allowed per appointment; 0 = patients cannot reschedule online. */
    maxPatientReschedules: number;
    /** No patient reschedule once the current start is this many hours away. */
    minRescheduleNoticeHours: number;
    readiness: BookingReadiness;
    live: boolean;
}

export type BookingSettingsUpdate = Partial<Pick<BookingSettings,
    "bookingSlug" | "bookingEnabled" | "slotIntervalMinutes" | "bufferMinutes" | "minLeadMinutes" | "maxHorizonDays"
    | "maxPatientReschedules" | "minRescheduleNoticeHours">>;

export const MAX_PATIENT_RESCHEDULES = 10;
export const MAX_RESCHEDULE_NOTICE_HOURS = 168;

export interface AvailabilityRule {
    weekday: number;
    startMinute: number;
    endMinute: number;
}

export interface Availability {
    timezone: string;
    rules: AvailabilityRule[];
}

export const MAX_AVAILABILITY_RULES = 50;

export const SLOT_INTERVAL_OPTIONS = [ 5, 10, 15, 20, 30, 45, 60, 90, 120 ] as const;
