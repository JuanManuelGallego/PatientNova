"use client";

import styles from "./Pickers.module.css";

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, "0");

export interface TimeChipsProps {
    hour: number | null;
    minute: number | null;
    /** Minutes offered for an hour: 0, step, 2·step... */
    minuteStep: number;
    /** Hours shown at all (e.g. business hours); every hour by default. */
    hours?: number[];
    disabledHours?: number[];
    disabledMinutes?: (hour: number) => number[];
    onHour: (hour: number) => void;
    onMinute: (minute: number) => void;
}

/**
 * Wall-clock time in two taps: the hour, then the minute at the field's step. An hour whose every minute is
 * disabled is disabled too, so a tap never leads to an empty minute row.
 */
export function TimeChips({ hour, minute, minuteStep, hours = ALL_HOURS, disabledHours = [], disabledMinutes, onHour, onMinute }: TimeChipsProps) {
    const step = Math.max(1, minuteStep);
    const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
    const minuteOff = (h: number) => new Set(disabledMinutes?.(h) ?? []);
    const hourOff = (h: number) => {
        if (disabledHours.includes(h)) return true;
        const off = minuteOff(h);
        return minutes.every((m) => off.has(m));
    };
    const offNow = hour === null ? new Set<number>() : minuteOff(hour);

    return (
        <div className={styles.time}>
            <div role="group" aria-label="Hora" className={styles.chipGroup}>
                <span className={styles.chipLabel} aria-hidden="true">Hora</span>
                <div className={styles.hourGrid}>
                    {hours.map((h) => (
                        <button key={h} type="button" className={styles.chip}
                            disabled={hourOff(h)} aria-pressed={h === hour} aria-label={`${pad(h)} h`}
                            onClick={() => onHour(h)}>
                            {pad(h)}
                        </button>
                    ))}
                </div>
            </div>
            {hour !== null && (
                <div role="group" aria-label="Minutos" className={styles.chipGroup}>
                    <span className={styles.chipLabel} aria-hidden="true">Minutos</span>
                    <div className={styles.minuteGrid}>
                        {minutes.map((m) => (
                            <button key={m} type="button" className={styles.chip}
                                disabled={offNow.has(m)} aria-pressed={m === minute} aria-label={`${pad(hour)}:${pad(m)}`}
                                onClick={() => onMinute(m)}>
                                :{pad(m)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
