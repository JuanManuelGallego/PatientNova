import { COMMON_TIMEZONES, fmtTimezoneLabel, zonedDateTimeParts } from "./TimeUtils";
import type { PublicSlot } from "@/src/types/PublicBooking";

/*
 * Helpers for the public booking page. Dates here are calendar days ("YYYY-MM-DD") in the provider's
 * zone; instants are always read through that zone (`zonedDateTimeParts`), never through `Date` getters.
 */

export const WEEK_DAYS = 7;

/** A "YYYY-MM-DD" calendar day moved by `days` (pure calendar math, no time zone). */
export function addCalendarDays(day: string, days: number): string {
    const [ y, m, d ] = day.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

export interface SlotDay {
    date: string;
    morning: PublicSlot[];
    afternoon: PublicSlot[];
}

/** Slots (sorted by start) grouped by their local date in `timezone`, split at 12:00 local. */
export function groupSlotsByDay(slots: PublicSlot[], timezone: string): SlotDay[] {
    const days = new Map<string, SlotDay>();
    for (const slot of slots) {
        const { dateStr, hour } = zonedDateTimeParts(slot.startUtc, timezone);
        let day = days.get(dateStr);
        if (!day) {
            day = { date: dateStr, morning: [], afternoon: [] };
            days.set(dateStr, day);
        }
        (hour < 12 ? day.morning : day.afternoon).push(slot);
    }
    return [ ...days.values() ];
}

export interface WeekPage {
    from: string;
    to: string;
    hasPrevious: boolean;
    hasNext: boolean;
}

/** The 7-day page starting at `start`, kept between today and the last bookable date. */
export function weekPage(start: string, today: string, lastBookableDate: string): WeekPage {
    const end = addCalendarDays(start, WEEK_DAYS - 1);
    return {
        from: start,
        to: end < lastBookableDate ? end : lastBookableDate,
        hasPrevious: start > today,
        hasNext: addCalendarDays(start, WEEK_DAYS) <= lastBookableDate,
    };
}

/** A calendar day as "lun, 9 nov" (read as a date, not through any time zone). */
export function fmtDayChip(day: string): string {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function fmtCop(value: number): string {
    return COP.format(value);
}

/** "Colombia (UTC-5) — Bogotá" for the zones the provider can pick, else "Bogota (GMT-5)". */
export function timezoneName(timezone: string): string {
    return COMMON_TIMEZONES.find((z) => z.value === timezone)?.label ?? fmtTimezoneLabel(timezone);
}
