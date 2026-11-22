"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES_ES } from "@/src/utils/TimeUtils";
import { addMonths, fmtMonth, monthGrid } from "@/src/utils/publicBooking";
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
}

export function MonthGrid({ month, selected, today, isDisabled, minMonth, maxMonth, years, onSelect, onMonth }: MonthGridProps) {
    const clamp = (next: string) =>
        minMonth && next < minMonth ? minMonth : maxMonth && next > maxMonth ? maxMonth : next;
    const [ year, monthIndex ] = month.split("-").map(Number) as [ number, number ];
    const cells = monthGrid(month);
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const last = weeks.at(-1)!;
    while (last.length < 7) last.push(null);

    const yearOptions: number[] = [];
    if (years) for (let y = years.to; y >= years.from; y--) yearOptions.push(y);

    return (
        <div className={styles.calendar}>
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
