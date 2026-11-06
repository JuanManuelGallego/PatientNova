import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, fmtDayParts, fmtMonth, monthGrid, monthOf } from "@/src/utils/publicBooking";
import styles from "./SlotChooser.module.css";

const WEEKDAYS = [ "D", "L", "M", "M", "J", "V", "S" ];

interface MonthCalendarProps {
    month: string;
    openDays: string[];
    selected: string | undefined;
    today: string;
    lastDate: string;
    loading: boolean;
    onSelect: (date: string) => void;
    onMonth: (month: string) => void;
}

export function MonthCalendar({ month, openDays, selected, today, lastDate, loading, onSelect, onMonth }: MonthCalendarProps) {
    return (
        <div className={styles.calendar} role="group" aria-label="Calendario de horarios" aria-busy={loading || undefined}>
            <div className={styles.calendarHead}>
                <button type="button" className={styles.iconButton} aria-label="Mes anterior" disabled={month <= monthOf(today)}
                    onClick={() => onMonth(addMonths(month, -1))}>
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span className={styles.monthName}>{fmtMonth(month)}</span>
                <button type="button" className={styles.iconButton} aria-label="Mes siguiente" disabled={month >= monthOf(lastDate)}
                    onClick={() => onMonth(addMonths(month, 1))}>
                    <ChevronRight size={20} aria-hidden="true" />
                </button>
            </div>
            <div className={styles.grid}>
                {WEEKDAYS.map((weekday, i) => <span key={i} className={styles.weekday} aria-hidden="true">{weekday}</span>)}
                {monthGrid(month).map((date, i) => {
                    if (!date) return <span key={`blank-${i}`} />;
                    const { dayNumber, full } = fmtDayParts(date);
                    const open = openDays.includes(date);
                    return (
                        <button key={date} type="button" className={styles.cell}
                            aria-disabled={open ? undefined : true}
                            aria-pressed={open ? date === selected : undefined}
                            aria-label={open ? full : `${full}, sin horarios`}
                            onClick={() => { if (open) onSelect(date); }}>
                            {dayNumber}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
