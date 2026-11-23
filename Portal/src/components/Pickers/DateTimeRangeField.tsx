"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PickerField } from "./PickerField";
import { TimeField } from "./TimeField";
import { END_OF_DAY, toMinutes, toTimeValue, type TimeFormat, type TimeRules } from "./timeRules";
import { dayValue, useZonedDay, type DateTimeWhen } from "./useZonedDay";
import styles from "./Pickers.module.css";

export interface DateTimeRange {
    start?: string;
    end?: string;
}

export interface DateTimeRangeFieldProps {
    value: DateTimeRange;
    onChange: (range: { start: string; end: string }) => void;
    when?: DateTimeWhen;
    time?: TimeRules;
    defaultDuration?: number;
    format?: TimeFormat;
    label?: ReactNode;
    ariaLabel?: string;
    invalid?: boolean;
    disabled?: boolean;
    testId?: string;
    popupContainer?: () => HTMLElement | null;
}

interface Parts {
    day: string | null;
    start: string | null;
    end: string | null;
}

const LAST_END = END_OF_DAY - 5;

export function DateTimeRangeField({
    value, onChange, when = "any", time, defaultDuration = 60, format, label, ariaLabel, invalid, disabled, testId, popupContainer,
}: DateTimeRangeFieldProps) {
    const zoned = useZonedDay(when, time);
    const labelId = useId();
    const step = time?.step ?? 5;
    const startRules: TimeRules = { max: toTimeValue(LAST_END - step) };

    const partsOf = (range: DateTimeRange): Parts => {
        const start = zoned.partsOf(range.start);
        const end = zoned.partsOf(range.end);
        return { day: start.day, start: start.time, end: end.day === start.day ? end.time : null };
    };
    const [ parts, setParts ] = useState<Parts>(() => partsOf(value));
    const [ shownFor, setShownFor ] = useState({ start: value.start, end: value.end, timezone: zoned.timezone });
    if (shownFor.start !== value.start || shownFor.end !== value.end || shownFor.timezone !== zoned.timezone) {
        setShownFor({ start: value.start, end: value.end, timezone: zoned.timezone });
        setParts(partsOf(value));
    }
    const latest = useRef(parts);
    useEffect(() => {
        latest.current = parts;
    }, [ parts ]);

    const commit = (next: Parts) => {
        latest.current = next;
        setParts(next);
        if (!next.day || !next.start || !next.end) return;
        const start = zoned.toIso(next.day, next.start);
        const end = zoned.toIso(next.day, next.end);
        if (start !== value.start || end !== value.end) onChange({ start, end });
    };

    const endFor = (start: string, previous: Parts) => {
        const from = toMinutes(start)!;
        const oldStart = previous.start === null ? null : toMinutes(previous.start);
        const oldEnd = previous.end === null ? null : toMinutes(previous.end);
        const length = oldStart !== null && oldEnd !== null && oldEnd > oldStart ? oldEnd - oldStart : defaultDuration;
        return toTimeValue(Math.min(Math.max(from + length, from + step), LAST_END));
    };

    const setDay = (day: string) => {
        const current = latest.current;
        const start = zoned.fitTime(day, current.start, startRules);
        commit({ day, start, end: start === null ? null : endFor(start, current) });
    };
    const setStart = (start: string | null) => {
        if (start === null) return;
        const current = latest.current;
        commit({ ...current, start, end: endFor(start, current) });
    };

    return (
        <div
            role="group"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
            className={label ? `form-label ${styles.dateTimeGroup}` : styles.dateTimeGroup}
        >
            {label && <span id={labelId}>{label}</span>}
            <div className={styles.dateTimeRange}>
                <PickerField
                    value={parts.day ? dayValue(parts.day) : null}
                    onChange={(d) => d && setDay(d.format("YYYY-MM-DD"))}
                    today={zoned.today}
                    format="DD/MM/YYYY"
                    placeholder="Fecha"
                    title="Fecha"
                    ariaLabel="Fecha"
                    disabledDate={zoned.disabledDate}
                    minMonth={zoned.minMonth}
                    maxMonth={zoned.maxMonth}
                    invalid={invalid}
                    disabled={disabled}
                    popupContainer={popupContainer}
                    testId={testId ? `${testId}-date` : undefined}
                />
                <TimeField
                    {...zoned.rulesFor(parts.day, startRules)}
                    value={parts.start}
                    onChange={setStart}
                    format={format}
                    placeholder="Desde"
                    ariaLabel="Desde"
                    invalid={invalid}
                    disabled={disabled}
                    testId={testId ? `${testId}-start` : undefined}
                />
                <TimeField
                    {...time}
                    max={toTimeValue(LAST_END)}
                    value={parts.end}
                    from={parts.start}
                    onChange={(end) => end !== null && commit({ ...latest.current, end })}
                    hint="duration"
                    format={format}
                    placeholder="Hasta"
                    ariaLabel="Hasta"
                    invalid={invalid}
                    disabled={disabled}
                    testId={testId ? `${testId}-end` : undefined}
                />
            </div>
        </div>
    );
}
