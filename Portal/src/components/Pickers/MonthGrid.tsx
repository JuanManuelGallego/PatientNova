"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES_ES } from "@/src/utils/TimeUtils";
import { addCalendarDays, addMonths, fmtMonth, lastDayOfMonth, monthGrid } from "@/src/utils/publicBooking";
import styles from "./Pickers.module.css";

const WEEKDAYS = [
    [ "L", "lunes" ], [ "M", "martes" ], [ "X", "miércoles" ], [ "J", "jueves" ], [ "V", "viernes" ], [ "S", "sábado" ],
    [ "D", "domingo" ],
] as const;

export function fmtDayLabel(day: string): string {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", {
        timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface MonthGridProps {
    month: string;
    selected?: string | null;
    today: string;
    isDisabled?: (day: string) => boolean;
    minMonth?: string;
    maxMonth?: string;
    years?: { from: number; to: number };
    onSelect: (day: string) => void;
    onMonth: (month: string) => void;
    /** Focus the day that holds the tab stop when the surrounding dialog opens. */
    autoFocus?: boolean;
}

export function MonthGrid({ month, selected, today, isDisabled, minMonth, maxMonth, years, onSelect, onMonth, autoFocus = false }: MonthGridProps) {
    const clamp = (next: string) =>
        minMonth && next < minMonth ? minMonth : maxMonth && next > maxMonth ? maxMonth : next;
    const [ year, monthIndex ] = month.split("-").map(Number) as [ number, number ];
    const cells = monthGrid(month);
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const last = weeks.at(-1)!;
    while (last.length < 7) last.push(null);

    const container = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<string | null>(null);
    useEffect(() => {
        const day = pendingFocus.current;
        if (!day) return;
        pendingFocus.current = null;
        container.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.focus();
    });

    // One day holds the tab stop: the selected one, else today, else the first enabled day of the month.
    const inMonth = (day: string | null | undefined): day is string => !!day && day.startsWith(month);
    const enabled = (day: string) => !(isDisabled?.(day) ?? false);
    const tabDay = [ selected, today ].find((d) => inMonth(d) && enabled(d))
        ?? cells.find((d): d is string => !!d && enabled(d)) ?? null;

    const withinBounds = (day: string) =>
        !(minMonth && day.slice(0, 7) < minMonth) && !(maxMonth && day.slice(0, 7) > maxMonth);
    // The next enabled day from `from` stepping by `step` days, or null when the bounds are reached first.
    const seek = (from: string, step: number): string | null => {
        let day = from;
        for (let i = 0; i < 400; i++) {
            if (!withinBounds(day)) return null;
            if (enabled(day)) return day;
            day = addCalendarDays(day, step);
        }
        return null;
    };
    const moveFocus = (target: string | null) => {
        if (!target) return;
        if (target.startsWith(month)) {
            container.current?.querySelector<HTMLElement>(`[data-day="${target}"]`)?.focus();
            return;
        }
        pendingFocus.current = target;
        onMonth(target.slice(0, 7));
    };
    const onDayKey = (e: KeyboardEvent<HTMLElement>, day: string) => {
        const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
        let target: string | null = null;
        switch (e.key) {
            case "ArrowLeft": target = seek(addCalendarDays(day, -1), -1); break;
            case "ArrowRight": target = seek(addCalendarDays(day, 1), 1); break;
            case "ArrowUp": target = seek(addCalendarDays(day, -7), -7); break;
            case "ArrowDown": target = seek(addCalendarDays(day, 7), 7); break;
            case "Home": target = seek(addCalendarDays(day, -weekday), 1); break;
            case "End": target = seek(addCalendarDays(day, 6 - weekday), -1); break;
            case "PageUp":
            case "PageDown": {
                const next = addMonths(day.slice(0, 7), e.key === "PageUp" ? -1 : 1);
                const clamped = `${next}-${String(Math.min(Number(day.slice(8)), Number(lastDayOfMonth(next).slice(8)))).padStart(2, "0")}`;
                target = seek(clamped, e.key === "PageUp" ? -1 : 1);
                break;
            }
            default: return;
        }
        e.preventDefault();
        moveFocus(target);
    };

    const yearOptions: number[] = [];
    if (years) for (let y = years.to; y >= years.from; y--) yearOptions.push(y);

    return (
        <div ref={container} className={styles.calendar}>
            <div className={styles.calendarHead}>
                <button type="button" className={styles.iconButton} aria-label="Mes anterior"
                    disabled={!!minMonth && month <= minMonth} onClick={() => onMonth(clamp(addMonths(month, -1)))}>
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                {years ? (
                    <div className={styles.monthSelects}>
                        <select className={styles.select} aria-label="Mes" value={monthIndex - 1}
                            onChange={(e) => onMonth(clamp(`${year}-${pad(Number(e.target.value) + 1)}`))}>
                            {MONTH_NAMES_ES.map((name, i) => {
                                const value = `${year}-${pad(i + 1)}`;
                                const outside = (!!minMonth && value < minMonth) || (!!maxMonth && value > maxMonth);
                                return <option key={name} value={i} disabled={outside}>{name}</option>;
                            })}
                        </select>
                        <select className={styles.select} aria-label="Año" value={year}
                            onChange={(e) => onMonth(clamp(`${e.target.value}-${pad(monthIndex)}`))}>
                            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                ) : (
                    <span className={styles.monthName} aria-live="polite">{fmtMonth(month)}</span>
                )}
                <button type="button" className={styles.iconButton} aria-label="Mes siguiente"
                    disabled={!!maxMonth && month >= maxMonth} onClick={() => onMonth(clamp(addMonths(month, 1)))}>
                    <ChevronRight size={20} aria-hidden="true" />
                </button>
            </div>
            <table aria-label={fmtMonth(month)} className={styles.grid}>
                <thead>
                    <tr>
                        {WEEKDAYS.map(([ short, full ]) => (
                            <th key={full} scope="col" abbr={full} aria-label={full} className={styles.weekday}>{short}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                {weeks.map((week, w) => (
                    <tr key={w}>
                        {week.map((day, d) => (
                            <td key={day ?? `blank-${w}-${d}`} className={styles.dayCell}>
                                {day && (
                                    <button type="button" className={styles.day}
                                        disabled={isDisabled?.(day) ?? false}
                                        data-day={day}
                                        data-autofocus={autoFocus && day === tabDay ? "" : undefined}
                                        tabIndex={day === tabDay ? 0 : -1}
                                        onKeyDown={(e) => onDayKey(e, day)}
                                        aria-pressed={day === selected}
                                        aria-current={day === today ? "date" : undefined}
                                        aria-label={fmtDayLabel(day)}
                                        onClick={() => onSelect(day)}>
                                        {Number(day.slice(8))}
                                    </button>
                                )}
                            </td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
