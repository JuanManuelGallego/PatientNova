"use client";

import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fromPickerValue, nowInZone, toPickerValue } from "@/src/utils/pickerValue";
import { todayFormattedString } from "@/src/utils/TimeUtils";
import { limitRules, resolveRules, timeOptions, toMinutes, toTimeValue, type TimeRules } from "./timeRules";

dayjs.extend(utc);

export type DateTimeWhen = "future" | "past" | "any";

export const dayValue = (day: string) => dayjs.utc(`${day}T00:00:00`);

export function useZonedDay(when: DateTimeWhen, time: TimeRules | ((day: string) => TimeRules) | undefined) {
    const timezone = useDisplayTimezone();
    const today = todayFormattedString(timezone);

    const rulesFor = (day: string | null, extra: TimeRules = {}): TimeRules => {
        const base = { ...(typeof time === "function" ? (day ? time(day) : {}) : time ?? {}), ...extra };
        if (day !== today || when === "any") return base;
        const wall = nowInZone(timezone);
        const now = wall.hour() * 60 + wall.minute();
        const limited = limitRules(resolveRules(base), when === "future" ? { min: now } : { max: now });
        return { ...base, min: toTimeValue(limited.min), max: toTimeValue(limited.max) };
    };

    const fitTime = (day: string, value: string | null, extra?: TimeRules): string | null => {
        if (value === null) return null;
        const rules = resolveRules(rulesFor(day, extra));
        const minutes = toMinutes(value)!;
        if (minutes >= rules.min && minutes <= rules.max) return value;
        const first = timeOptions(rules)[0];
        return first ? toTimeValue(first.minutes) : null;
    };

    const toIso = (day: string, value: string) => fromPickerValue(dayjs.utc(`${day}T${value}:00`), timezone);

    const partsOf = (iso: string | undefined): { day: string | null; time: string | null } => {
        if (!iso) return { day: null, time: null };
        const wall = toPickerValue(iso, timezone);
        return { day: wall.format("YYYY-MM-DD"), time: wall.format("HH:mm") };
    };

    const disabledDate = when === "any" ? undefined
        : (d: Dayjs) => (when === "future" ? d.format("YYYY-MM-DD") < today : d.format("YYYY-MM-DD") > today);

    return {
        timezone,
        today,
        rulesFor,
        fitTime,
        toIso,
        partsOf,
        disabledDate,
        minMonth: when === "future" ? today.slice(0, 7) : undefined,
        maxMonth: when === "past" ? today.slice(0, 7) : undefined,
    };
}
