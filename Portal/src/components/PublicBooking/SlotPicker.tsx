"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFetchPublicSlots } from "@/src/api/public-booking/useFetchPublicSlots";
import type { PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import { fmtTime, todayFormattedString } from "@/src/utils/TimeUtils";
import {
    addCalendarDays, calendarDaysBetween, fmtDayParts, fmtWeekRange, groupSlotsByDay, lastBookableDateIn, slotQueryRange,
    timezoneName, WEEK_DAYS, weekPage,
} from "@/src/utils/publicBooking";
import { ErrorState } from "./PublicStates";
import styles from "./PublicBooking.module.css";

/**
 * Week, day and time selection for one appointment type, in the patient's device zone. Shared by booking
 * (`/book/[slug]`) and rescheduling ("Mis citas"), so both follow the same zone and paging rules.
 */
export function useSlotPicker(slug: string, provider: PublicProvider, typeId: string | null, timezone: string) {
    const today = todayFormattedString(timezone);
    const [ weekStart, setWeekStart ] = useState<string | null>(null);
    const [ dayChoice, setDayChoice ] = useState<string | null>(null);
    const [ startUtc, setStartUtc ] = useState<string | null>(null);
    const [ notice, setNotice ] = useState<string | null>(null);

    const lastDate = lastBookableDateIn(timezone, provider.lastBookableDate, provider.timezone);
    const page = weekPage(weekStart ?? today, today, lastDate);
    const query = slotQueryRange(page.from, page.to);
    const { slots, loading, error, retry } = useFetchPublicSlots(slug, typeId, query.from, query.to);
    const slotDays = new Map((slots ? groupSlotsByDay(slots.slots, timezone) : []).map((d) => [ d.date, d ]));
    const weekDays = calendarDaysBetween(page.from, page.to);
    const openDays = weekDays.filter((d) => slotDays.has(d));
    const day = slotDays.get(dayChoice && openDays.includes(dayChoice) ? dayChoice : openDays[ 0 ] ?? "");
    const slot = day && [ ...day.morning, ...day.afternoon ].find((s) => s.startUtc === startUtc);

    const pick = (next: string | null) => {
        setStartUtc(next);
        setNotice(null);
    };
    const goToWeek = (start: string) => {
        setWeekStart(start);
        setDayChoice(null);
        pick(null);
    };

    return {
        timezone,
        page,
        weekDays,
        openDays,
        day,
        slot: slot ?? undefined,
        slots,
        loading,
        error,
        retry,
        notice,
        pick,
        goToWeek,
        nextWeek: () => goToWeek(addCalendarDays(page.from, WEEK_DAYS)),
        previousWeek: () => goToWeek(addCalendarDays(page.from, -WEEK_DAYS)),
        chooseDay: (date: string) => { setDayChoice(date); pick(null); },
        clearSelection: () => { setDayChoice(null); pick(null); },
        /** The server refused the chosen time: drop it, say why and reload the slots. */
        slotTaken: (message: string) => {
            setStartUtc(null);
            setNotice(message);
            retry();
        },
    };
}

export type SlotPicker = ReturnType<typeof useSlotPicker>;

interface SlotStepsProps {
    picker: SlotPicker;
    /** Number shown on the "Día" step; "Hora" follows it. */
    firstStep: number;
    noticeRef?: React.Ref<HTMLParagraphElement>;
}

export function SlotSteps({ picker, firstStep, noticeRef }: SlotStepsProps) {
    const { page, weekDays, openDays, day, slot, slots, loading, error, retry, notice, timezone } = picker;
    return (
        <>
            <Step
                number={firstStep}
                title="Día"
                aside={
                    <div className={styles.weekNav}>
                        <button type="button" className={styles.iconButton} aria-label="Semana anterior" disabled={!page.hasPrevious}
                            onClick={picker.previousWeek}>
                            <ChevronLeft size={20} aria-hidden="true" />
                        </button>
                        <span className={styles.weekLabel}>{fmtWeekRange(page.from, page.to)}</span>
                        <button type="button" className={styles.iconButton} aria-label="Semana siguiente" disabled={!page.hasNext}
                            onClick={picker.nextWeek}>
                            <ChevronRight size={20} aria-hidden="true" />
                        </button>
                    </div>
                }
            >
                {error ? <ErrorState error={error} onRetry={retry} inline />
                    : loading || !slots ? <DaysSkeleton />
                    : (
                        <div className={styles.days} role="group" aria-label="Días de la semana">
                            {weekDays.map((date) => {
                                const { weekday, dayNumber, full } = fmtDayParts(date);
                                const open = openDays.includes(date);
                                return (
                                    <button key={date} type="button" className={styles.day}
                                        aria-disabled={open ? undefined : true}
                                        aria-pressed={open ? date === day?.date : undefined}
                                        aria-label={open ? full : `${full}, sin horarios`}
                                        data-tooltip={open ? undefined : "Sin horarios disponibles"}
                                        onClick={() => { if (open) picker.chooseDay(date); }}>
                                        <span className={styles.dayWeekday}>{weekday}</span>
                                        <span className={styles.dayNumber}>{dayNumber}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
            </Step>

            <Step number={firstStep + 1} title="Hora">
                {notice && <p ref={noticeRef} tabIndex={-1} className={styles.notice} role="alert">{notice}</p>}
                {error ? null
                    : loading || !slots ? <TimesSkeleton />
                    : !day ? (
                        <div className={styles.empty}>
                            <p className={styles.muted}>No hay horarios disponibles esta semana.</p>
                            {page.hasNext && (
                                <button type="button" className="btn-secondary" onClick={picker.nextWeek}>Ver la semana siguiente</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <TimeGroup title="Mañana" slots={day.morning} timezone={timezone} selected={slot?.startUtc} onSelect={picker.pick} />
                            <TimeGroup title="Tarde" slots={day.afternoon} timezone={timezone} selected={slot?.startUtc} onSelect={picker.pick} />
                        </>
                    )}
                <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            </Step>
        </>
    );
}

export function reveal(el: HTMLElement | null) {
    if (!el?.scrollIntoView) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

interface StepProps {
    number: number;
    title: string;
    aside?: React.ReactNode;
    stepRef?: React.Ref<HTMLDivElement>;
    children: React.ReactNode;
}

export function Step({ number, title, aside, stepRef, children }: StepProps) {
    const id = `step-${number}`;
    return (
        <div ref={stepRef} className={styles.step} role="group" aria-labelledby={id}>
            <div className={styles.stepHead}>
                <h2 id={id} className={styles.stepTitle}>
                    <span className={styles.stepNumber} aria-hidden="true">{number}</span>
                    {title}
                </h2>
                {aside}
            </div>
            {children}
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
            <p className={styles.period}>{title}</p>
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

function DaysSkeleton() {
    return (
        <div className={styles.days} aria-busy="true" aria-label="Cargando días">
            {Array.from({ length: WEEK_DAYS }, (_, i) => <div key={i} className={`skeleton-bar ${styles.daySkeleton}`} />)}
        </div>
    );
}

function TimesSkeleton() {
    return (
        <div className={styles.times} aria-busy="true" aria-label="Cargando horarios">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className={`skeleton-bar ${styles.timeSkeleton}`} />)}
        </div>
    );
}
