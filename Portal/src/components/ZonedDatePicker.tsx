"use client";

import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
import advancedFormat from "dayjs/plugin/advancedFormat";
import weekday from "dayjs/plugin/weekday";
import localeData from "dayjs/plugin/localeData";
import weekOfYear from "dayjs/plugin/weekOfYear";
import weekYear from "dayjs/plugin/weekYear";
import { fromWallClock, getDisplayTimezone, toWallClock } from "@/src/utils/TimeUtils";

dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);
dayjs.extend(weekYear);

/*
 * antd/dayjs pickers only know the browser zone, and a browser-local dayjs silently moves a wall time that
 * falls in the browser zone's DST gap (02:30 on a spring-forward day becomes 03:30). This picker holds the
 * provider's wall-clock time as a UTC-mode dayjs instead: UTC has no DST, so every wall time exists, and
 * the UTC instant is only computed at the edges (`toPickerValue` / `fromPickerValue`) in the provider's zone.
 */
type PickerConfig = Parameters<typeof DatePicker.generatePicker<Dayjs>>[0];

const parseLocale = (locale: string) => locale.split("_")[0].toLowerCase();

const zonedConfig: PickerConfig = {
    getNow: () => nowInZone(),
    getFixedDate: (fixed) => dayjs.utc(fixed, "YYYY-M-DD"),
    getEndDate: (date) => date.endOf("month"),
    getWeekDay: (date) => {
        const clone = date.locale("en");
        return clone.weekday() + clone.localeData().firstDayOfWeek();
    },
    getYear: (date) => date.year(),
    getMonth: (date) => date.month(),
    getDate: (date) => date.date(),
    getHour: (date) => date.hour(),
    getMinute: (date) => date.minute(),
    getSecond: (date) => date.second(),
    getMillisecond: (date) => date.millisecond(),
    addYear: (date, diff) => date.add(diff, "year"),
    addMonth: (date, diff) => date.add(diff, "month"),
    addDate: (date, diff) => date.add(diff, "day"),
    setYear: (date, year) => date.year(year),
    setMonth: (date, month) => date.month(month),
    setDate: (date, num) => date.date(num),
    setHour: (date, hour) => date.hour(hour),
    setMinute: (date, minute) => date.minute(minute),
    setSecond: (date, second) => date.second(second),
    setMillisecond: (date, ms) => date.millisecond(ms),
    isAfter: (date1, date2) => date1.isAfter(date2),
    isValidate: (date) => date.isValid(),
    locale: {
        getWeekFirstDay: (locale) => dayjs().locale(parseLocale(locale)).localeData().firstDayOfWeek(),
        getWeekFirstDate: (locale, date) => date.locale(parseLocale(locale)).weekday(0),
        getWeek: (locale, date) => date.locale(parseLocale(locale)).week(),
        getShortWeekDays: (locale) => dayjs().locale(parseLocale(locale)).localeData().weekdaysMin(),
        getShortMonths: (locale) => dayjs().locale(parseLocale(locale)).localeData().monthsShort(),
        format: (locale, date, format) => date.locale(parseLocale(locale)).format(format),
        parse: (locale, text, formats) => {
            for (const format of formats) {
                const date = dayjs.utc(text, format, true).locale(parseLocale(locale));
                if (date.isValid()) return date;
            }
            return null;
        },
    },
};

/** antd DatePicker whose values are the provider's wall-clock time as UTC-mode dayjs objects. */
export const ZonedDatePicker = DatePicker.generatePicker<Dayjs>(zonedConfig);

/** The current wall-clock time in `timezone` (display zone if omitted), as a picker value. */
export function nowInZone(timezone: string = getDisplayTimezone()): Dayjs {
    return dayjs.utc(toWallClock(new Date(), timezone));
}

/** A stored value (UTC instant, or "YYYY-MM-DD" day) as a picker value showing its wall clock in `timezone`. */
export function toPickerValue(value: string, timezone: string = getDisplayTimezone()): Dayjs {
    return dayjs.utc(toWallClock(value, timezone));
}

/** A picker value back to a UTC ISO instant, reading its wall clock in `timezone`. */
export function fromPickerValue(value: Dayjs, timezone: string = getDisplayTimezone()): string {
    return fromWallClock(value.format("YYYY-MM-DDTHH:mm:ss"), timezone);
}
