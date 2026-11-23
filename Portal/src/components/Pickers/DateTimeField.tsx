"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PickerField } from "./PickerField";
import { TimeField, type TimeFieldProps } from "./TimeField";
import type { TimeFormat, TimeRules } from "./timeRules";
import { dayValue, useZonedDay, type DateTimeWhen } from "./useZonedDay";
import styles from "./Pickers.module.css";

export type { DateTimeWhen } from "./useZonedDay";

export interface DateTimeFieldProps {
    value: string | undefined;
    onChange: (iso: string) => void;
    when?: DateTimeWhen;
    time?: TimeRules | ((day: string) => TimeRules);
    hint?: TimeFieldProps["hint"];
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
    time: string | null;
}

export function DateTimeField({
    value, onChange, when = "any", time, hint, format, label, ariaLabel, invalid, disabled, testId, popupContainer,
}: DateTimeFieldProps) {
    const zoned = useZonedDay(when, time);
    const labelId = useId();

    const [ parts, setParts ] = useState<Parts>(() => zoned.partsOf(value));
    const [ shownFor, setShownFor ] = useState({ value, timezone: zoned.timezone });
    if (shownFor.value !== value || shownFor.timezone !== zoned.timezone) {
        setShownFor({ value, timezone: zoned.timezone });
        setParts(zoned.partsOf(value));
    }
    const latest = useRef(parts);
    useEffect(() => {
        latest.current = parts;
    }, [ parts ]);

    const commit = (next: Parts) => {
        latest.current = next;
        setParts(next);
        if (!next.day || !next.time) return;
        const iso = zoned.toIso(next.day, next.time);
        if (iso !== value) onChange(iso);
    };

    return (
        <div
            role="group"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
            className={label ? `form-label ${styles.dateTimeGroup}` : styles.dateTimeGroup}
        >
            {label && <span id={labelId}>{label}</span>}
            <div className={styles.dateTime}>
                <PickerField
                    value={parts.day ? dayValue(parts.day) : null}
                    onChange={(d) => {
                        if (!d) return;
                        const day = d.format("YYYY-MM-DD");
                        commit({ day, time: zoned.fitTime(day, latest.current.time) });
                    }}
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
                    {...zoned.rulesFor(parts.day)}
                    value={parts.time}
                    onChange={(next) => next !== null && commit({ day: latest.current.day, time: next })}
                    hint={hint}
                    format={format}
                    placeholder="Hora"
                    ariaLabel="Hora"
                    invalid={invalid}
                    disabled={disabled}
                    testId={testId ? `${testId}-time` : undefined}
                />
            </div>
        </div>
    );
}
