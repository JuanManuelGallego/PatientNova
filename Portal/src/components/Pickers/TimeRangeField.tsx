"use client";

import { TimeField } from "./TimeField";
import { END_OF_DAY, toMinutes, toTimeValue, type TimeFormat } from "./timeRules";
import styles from "./Pickers.module.css";

export interface TimeRange {
    start: string;
    end: string;
}

export interface TimeRangeFieldProps {
    value: TimeRange;
    onChange: (range: TimeRange) => void;
    startLabel: string;
    endLabel: string;
    endOfDay?: boolean;
    step?: number;
    listStep?: number;
    format?: TimeFormat;
    invalid?: boolean;
    disabled?: boolean;
    startTestId?: string;
    endTestId?: string;
}

const LAST_START = END_OF_DAY - 5;

export function TimeRangeField({
    value, onChange, startLabel, endLabel, endOfDay = false, step = 5, listStep, format, invalid, disabled, startTestId, endTestId,
}: TimeRangeFieldProps) {
    const lastEnd = endOfDay ? END_OF_DAY : LAST_START;
    const moveStart = (next: string | null) => {
        if (next === null) return;
        const oldStart = toMinutes(value.start) ?? 0;
        const oldEnd = toMinutes(value.end) ?? oldStart;
        const startMinutes = toMinutes(next)!;
        const length = oldEnd > oldStart ? oldEnd - oldStart : 60;
        const end = Math.max(Math.min(startMinutes + length, lastEnd), Math.min(startMinutes + step, lastEnd));
        onChange({ start: next, end: toTimeValue(end) });
    };

    return (
        <div className={styles.timeRange}>
            <TimeField value={value.start} onChange={moveStart} ariaLabel={startLabel} max={toTimeValue(LAST_START)}
                step={step} listStep={listStep} format={format} invalid={invalid} disabled={disabled} testId={startTestId} />
            <span className={styles.timeRangeDash} aria-hidden="true">–</span>
            <TimeField value={value.end} onChange={(end) => end !== null && onChange({ start: value.start, end })}
                from={value.start} hint="duration" endOfDay={endOfDay} ariaLabel={endLabel}
                step={step} listStep={listStep} format={format} invalid={invalid} disabled={disabled} testId={endTestId} />
        </div>
    );
}
