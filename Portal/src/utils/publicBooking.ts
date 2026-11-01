import { COMMON_TIMEZONES, fmtTimezoneLabel, zonedDateTimeParts } from "./TimeUtils";
import type { PublicSlot } from "@/src/types/PublicBooking";


export const WEEK_DAYS = 7;

export function addCalendarDays(day: string, days: number): string {
    const [ y, m, d ] = day.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

export interface SlotDay {
    date: string;
    morning: PublicSlot[];
    afternoon: PublicSlot[];
}

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

export function weekPage(start: string, today: string, lastBookableDate: string): WeekPage {
    const from = start < lastBookableDate ? start : lastBookableDate;
    const end = addCalendarDays(from, WEEK_DAYS - 1);
    return {
        from,
        to: end < lastBookableDate ? end : lastBookableDate,
        hasPrevious: from > today,
        hasNext: addCalendarDays(from, WEEK_DAYS) <= lastBookableDate,
    };
}

export function fmtDayChip(day: string): string {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function fmtCop(value: number): string {
    return COP.format(value);
}

export function timezoneName(timezone: string): string {
    return COMMON_TIMEZONES.find((z) => z.value === timezone)?.label ?? fmtTimezoneLabel(timezone);
}
