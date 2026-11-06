"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useHistoryOverlay } from "@/src/hooks/useHistoryOverlay";
import type { PublicSlot } from "@/src/types/PublicBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { fmtDayParts, fmtShortDayTime, lastDayOfMonth, monthOf, timezoneName } from "@/src/utils/publicBooking";
import { MonthCalendar } from "./MonthCalendar";
import { ErrorState } from "./PublicStates";
import { PublicSheet } from "./PublicSheet";
import type { SlotChooserState } from "./useSlotChooser";
import styles from "./SlotChooser.module.css";

const SKELETON_TIMES = 4;

/** First-available shortcut, then a strip of open days on phones or a month calendar on desktop, then the day's times. */
export function SlotChooser({ picker }: { picker: SlotChooserState }) {
    const { today, lastDate, openDays, day, slot, firstSlot, loading, error, retry, notice, timezone } = picker;
    const calendarSheet = useHistoryOverlay("calendar");
    const [ monthChoice, setMonthChoice ] = useState<string | null>(null);
    const noticeRef = useRef<HTMLParagraphElement>(null);
    const month = monthChoice ?? monthOf(day?.date ?? today);

    useEffect(() => {
        if (notice) noticeRef.current?.focus();
    }, [ notice ]);

    const goToMonth = (next: string) => {
        setMonthChoice(next);
        picker.loadThrough(lastDayOfMonth(next));
    };
    const calendar = (onSelect: (date: string) => void) => (
        <MonthCalendar month={month} openDays={openDays} selected={day?.date} today={today} lastDate={lastDate} loading={loading}
            onSelect={onSelect} onMonth={goToMonth} />
    );

    const nothingYet = openDays.length === 0;
    return (
        <div className={styles.chooser}>
            {notice && <p ref={noticeRef} tabIndex={-1} className={styles.notice} role="alert">{notice}</p>}
            {error && <ErrorState error={error} onRetry={retry} inline />}
            {!error && nothingYet && loading && <TimesSkeleton />}
            {!error && nothingYet && !loading && (
                <div className={styles.empty}>
                    <p className={styles.muted}>No hay horarios disponibles por ahora.</p>
                    {picker.hasMore && <button type="button" className="btn-secondary" onClick={picker.loadMore}>Buscar más adelante</button>}
                </div>
            )}
            {!nothingYet && (
                <>
                    {firstSlot && (
                        <button type="button" className={styles.first} aria-pressed={slot?.startUtc === firstSlot.startUtc} onClick={picker.chooseFirst}>
                            <span>
                                <span className={styles.firstLabel}>Primer horario disponible</span>
                                <span className={styles.firstTime}>{fmtShortDayTime(firstSlot.startUtc, timezone)}</span>
                            </span>
                            <ArrowRight size={18} aria-hidden="true" />
                        </button>
                    )}
                    <div className={styles.pickDay}>
                        <div className={styles.phoneDays}>
                            <div className={styles.stripHead}>
                                <p className={styles.label}>O elige otro día</p>
                                <button type="button" className={styles.calendarLink} onClick={calendarSheet.show}>
                                    <CalendarDays size={16} aria-hidden="true" />Ver calendario
                                </button>
                            </div>
                            <div className={styles.strip} role="group" aria-label="Días disponibles">
                                {openDays.map((date) => {
                                    const { weekday, dayNumber, full } = fmtDayParts(date);
                                    return (
                                        <button key={date} type="button" className={styles.day} aria-pressed={date === day?.date} aria-label={full}
                                            onClick={() => picker.chooseDay(date)}>
                                            <span className={styles.dayWeekday}>{weekday}</span>
                                            <span className={styles.dayNumber}>{dayNumber}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {picker.hasMore && (
                                <button type="button" className={styles.moreDays} disabled={loading} onClick={picker.loadMore}>Ver más fechas</button>
                            )}
                        </div>
                        <div className={styles.desktopCalendar}>{calendar(picker.chooseDay)}</div>
                        {day && (
                            <div className={styles.dayTimes}>
                                <TimeGroup title="Mañana" slots={day.morning} timezone={timezone} selected={slot?.startUtc} onSelect={picker.pick} />
                                <TimeGroup title="Tarde" slots={day.afternoon} timezone={timezone} selected={slot?.startUtc} onSelect={picker.pick} />
                            </div>
                        )}
                    </div>
                </>
            )}
            <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            {calendarSheet.open && (
                <PublicSheet title="Calendario de horarios" onClose={calendarSheet.hide}>
                    <div className={styles.sheetCalendar}>
                        {calendar((date) => { picker.chooseDay(date); calendarSheet.hide(); })}
                    </div>
                </PublicSheet>
            )}
        </div>
    );
}

interface TimeGroupProps {
    title: string;
    slots: PublicSlot[];
    timezone: string;
    selected: string | undefined;
    onSelect: (startUtc: string) => void;
}

function TimeGroup({ title, slots, timezone, selected, onSelect }: TimeGroupProps) {
    if (slots.length === 0) return null;
    return (
        <div>
            <p className={styles.label}>{title}</p>
            <ul className={styles.times} aria-label={title}>
                {slots.map((s) => (
                    <li key={s.startUtc}>
                        <button type="button" className={styles.time} aria-pressed={s.startUtc === selected} onClick={() => onSelect(s.startUtc)}>
                            {fmtTime(s.startUtc, timezone)}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TimesSkeleton() {
    return (
        <div className={styles.times} aria-busy="true" aria-label="Cargando horarios">
            {Array.from({ length: SKELETON_TIMES }, (_, i) => <div key={i} className={`skeleton-bar ${styles.timeSkeleton}`} />)}
        </div>
    );
}
