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
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fromWallClock, getDisplayTimezone, todayFormattedString, toWallClock } from "@/src/utils/TimeUtils";
import { TouchPickerField } from "@/src/components/Pickers/TouchPickerField";

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

const BasePicker = DatePicker.generatePicker<Dayjs>(zonedConfig);

/** True on touch devices, where focusing the text input would open the on-screen keyboard over the popup. */
export function useCoarsePointer(): boolean {
    return useMediaQuery("(pointer: coarse)");
}

// Props are typed by the generated picker (generics survive only on the cast result below).
type AnyProps = Record<string, unknown>;
const Base = BasePicker as unknown as React.ComponentType<AnyProps>;
const BaseTime = BasePicker.TimePicker as unknown as React.ComponentType<AnyProps>;

function ZonedDatePickerBase(props: AnyProps) {
    const coarse = useCoarsePointer();
    return <Base inputReadOnly={coarse} {...props} />;
}

interface TimePickerTouchProps {
    value?: Dayjs | null;
    onChange?: (value: Dayjs | null, text: string) => void;
    format?: string;
    minuteStep?: number;
    allowClear?: boolean;
    disabled?: boolean;
    placeholder?: string;
    status?: string;
    disabledTime?: (now: Dayjs) => { disabledHours?: () => number[]; disabledMinutes?: (hour: number) => number[] };
    getPopupContainer?: (trigger: HTMLElement) => HTMLElement;
    className?: string;
    style?: React.CSSProperties;
    "aria-label"?: string;
    "aria-invalid"?: boolean;
    "data-testid"?: string;
}

/** On touch screens: hour then minute chips in a bottom sheet, instead of antd's scrolling columns. */
function TouchTimePicker(props: TimePickerTouchProps) {
    const timezone = useDisplayTimezone();
    const format = props.format ?? "HH:mm";
    const value = props.value ?? null;
    return (
        <TouchPickerField
            kind="time"
            value={value}
            onChange={(next) => props.onChange?.(next, next ? next.format(format) : "")}
            today={todayFormattedString(timezone)}
            format={format}
            placeholder={props.placeholder ?? "Selecciona hora"}
            title={props["aria-label"] ?? "Hora"}
            disabledTime={props.disabledTime ? (day) => props.disabledTime!(day ?? nowInZone(timezone)) : undefined}
            minuteStep={props.minuteStep ?? 1}
            allowClear={props.allowClear ?? true}
            disabled={props.disabled}
            invalid={props.status === "error" || props["aria-invalid"] === true}
            ariaLabel={props["aria-label"]}
            testId={props["data-testid"]}
            className={props.className}
            style={props.style}
        />
    );
}

function ZonedTimePicker(props: AnyProps) {
    const coarse = useCoarsePointer();
    if (coarse) return <TouchTimePicker {...(props as TimePickerTouchProps)} />;
    return <BaseTime {...props} />;
}

/**
 * antd DatePicker whose values are the provider's wall-clock time as UTC-mode dayjs objects. The base picker's
 * input is read-only on touch devices (no keyboard over the popup); callers can override `inputReadOnly`, and the
 * date wrappers (DateTimePicker, AppointmentDateTimePicker) render the touch sheet there instead. `TimePicker` is
 * itself the chip sheet (`TouchPickerField`) on touch devices and antd's picker otherwise.
 */
export const ZonedDatePicker = Object.assign(ZonedDatePickerBase, {
    // The other statics are the generated ones (without the touch default), so the cast below stays true at runtime.
    WeekPicker: BasePicker.WeekPicker,
    MonthPicker: BasePicker.MonthPicker,
    YearPicker: BasePicker.YearPicker,
    QuarterPicker: BasePicker.QuarterPicker,
    RangePicker: BasePicker.RangePicker,
    TimePicker: ZonedTimePicker,
}) as unknown as typeof BasePicker;

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
