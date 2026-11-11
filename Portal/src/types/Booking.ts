import { ReminderType } from "./Reminder";

export type BookingApprovalMode = "AUTO_CONFIRM" | "REQUIRE_APPROVAL";

export type PortalReminderTiming =
    | "NONE" | "ONE_HOUR_BEFORE" | "ONE_DAY_BEFORE" | "SAME_DAY_MORNING" | "PREVIOUS_DAY_MORNING" | "PREVIOUS_DAY_EVENING";

export const PORTAL_REMINDER_TIMINGS: { value: PortalReminderTiming; type: ReminderType }[] = [
    { value: "NONE", type: ReminderType.NONE },
    { value: "ONE_HOUR_BEFORE", type: ReminderType.ONE_HOUR_BEFORE },
    { value: "ONE_DAY_BEFORE", type: ReminderType.ONE_DAY_BEFORE },
    { value: "SAME_DAY_MORNING", type: ReminderType.SAME_DAY_MORNING },
    { value: "PREVIOUS_DAY_MORNING", type: ReminderType.PREVIOUS_DAY_MORNING },
    { value: "PREVIOUS_DAY_EVENING", type: ReminderType.PREVIOUS_DAY_EVENING },
];

export interface BookingReadiness {
    hasSlug: boolean;
    hasLegalIdentity: boolean;
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
    maxPatientReschedules: number;
    minRescheduleNoticeHours: number;
    portalReminderTiming: PortalReminderTiming;
    bio: string | null;
    specialty: string | null;
    publicPhone: string | null;
    publicWhatsapp: string | null;
    legalName: string | null;
    privacyContact: string | null;
    contactHours: string | null;
    readiness: BookingReadiness;
    live: boolean;
}

export type BookingSettingsUpdate = Partial<Pick<BookingSettings,
    "bookingSlug" | "bookingEnabled" | "bookingApprovalMode" | "slotIntervalMinutes" | "bufferMinutes" | "minLeadMinutes" | "maxHorizonDays"
    | "maxPatientReschedules" | "minRescheduleNoticeHours" | "portalReminderTiming"
    | "bio" | "specialty" | "publicPhone" | "publicWhatsapp" | "legalName" | "privacyContact" | "contactHours">>;

export const MAX_PATIENT_RESCHEDULES = 10;
export const MAX_RESCHEDULE_NOTICE_HOURS = 168;
export const MAX_BIO_LENGTH = 600;
export const MAX_SPECIALTY_LENGTH = 120;
export const MAX_LEGAL_TEXT_LENGTH = 200;
export const MAX_CONTACT_HOURS_LENGTH = 120;

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
