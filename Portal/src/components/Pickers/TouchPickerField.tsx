"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/es";
import { CalendarDays, Clock, X } from "lucide-react";
import { Sheet } from "@/src/components/Sheet/Sheet";
import { useAfterOverlaysSettle } from "@/src/hooks/useFocusTrap";
import { MonthGrid } from "./MonthGrid";
import { TimeChips } from "./TimeChips";
import styles from "./Pickers.module.css";

dayjs.extend(utc);

export type TouchPickerKind = "date" | "dateTime" | "time";

/** The shape antd's `disabledTime` returns, so the wrappers share one rule between desktop and touch. */
export interface DisabledTimeConfig {
    disabledHours?: () => number[];
    disabledMinutes?: (hour: number) => number[];
}

export interface TouchPickerFieldProps {
    kind: TouchPickerKind;
    /** Wall-clock value as a UTC-mode dayjs (see ZonedDatePicker), or null when empty. */
    value: Dayjs | null;
    onChange: (value: Dayjs | null) => void;
    /** The provider's today, "YYYY-MM-DD". */
    today: string;
    /** dayjs format of the trigger text, e.g. "DD/MM/YYYY HH:mm". */
    format: string;
    placeholder?: string;
    /** The sheet's heading. */
    title: string;
    /** Called with a day at wall-clock midnight (UTC mode). */
    disabledDate?: (day: Dayjs) => boolean;
    /** Called with the drafted day at wall-clock midnight (UTC mode), or the value's day for `time`. */
    disabledTime?: (day: Dayjs | null) => DisabledTimeConfig | undefined;
    minuteStep?: number;
    /** Hours offered at all, e.g. business hours; all 24 by default. */
    hours?: number[];
    /** Months the calendar can reach, "YYYY-MM". */
    minMonth?: string;
    maxMonth?: string;
    /** Month shown when the field is empty; today's by default. */
    initialMonth?: string;
    /** Adds month and year selects to the calendar header (birth dates). */
    years?: { from: number; to: number };
    allowClear?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    ariaLabel?: string;
    /** Where the sheet renders; `document.body` by default. A header popover passes itself so taps stay "inside". */
    popupContainer?: () => HTMLElement | null;
    testId?: string;
    className?: string;
    style?: CSSProperties;
}

interface Draft {
    day: string | null;
    hour: number | null;
    minute: number | null;
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, "0");
const dayValue = (day: string) => dayjs.utc(`${day}T00:00:00`);
/** Fecha and Hora are two tabs: arrows and Home/End move between them, Tab enters the panel. */
const TAB_KEYS: Record<string, "date" | "time"> = { ArrowLeft: "date", ArrowRight: "time", Home: "date", End: "time" };
const EMPTY: Draft = { day: null, hour: null, minute: null };
const fmtTabDay = (day: string) => dayValue(day).locale("es").format("ddd D MMM YYYY").replace(/\./g, "");

/**
 * A touch replacement for antd's pickers: a field that opens the shared bottom sheet with a month calendar
 * and/or hour-then-minute chips. It works only on wall-clock values, so the wrappers convert at the edges
 * exactly as they do for antd (`toPickerValue` / `fromPickerValue`, calendar days).
 */
export function TouchPickerField(props: TouchPickerFieldProps) {
    const {
        kind, value, onChange, today, format, placeholder, title, disabledDate, disabledTime, minuteStep = 1,
        hours = ALL_HOURS, minMonth, maxMonth, initialMonth, years, allowClear = false, disabled, invalid, ariaLabel,
        popupContainer, testId, className, style,
    } = props;
    const [ open, setOpen ] = useState(false);
    const [ draft, setDraft ] = useState<Draft>(EMPTY);
    // The draft as it was when the sheet opened: confirming it unchanged saves nothing.
    const [ initial, setInitial ] = useState<Draft>(EMPTY);
    const [ view, setView ] = useState<"date" | "time">("date");
    const [ month, setMonth ] = useState(today.slice(0, 7));
    const panelId = useId();
    const valueId = useId();
    const dateTabId = useId();
    const timeTabId = useId();
    // The tapped day unmounts when the view turns to the time: focus moves to the tab so it stays in the sheet.
    const dateTab = useRef<HTMLButtonElement>(null);
    const timeTab = useRef<HTMLButtonElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    // Inside a <label> the label names the trigger, so the value becomes its description; outside, the value
    // already is its name and describing it again would read it twice.
    const [ labelled, setLabelled ] = useState(false);
    useEffect(() => {
        setLabelled((trigger.current?.labels?.length ?? 0) > 0);
    }, []);

    /*
     * The value is emitted only once the sheet's history entry is gone. Closing the sheet goes back() over that
     * entry on a later task; a URL write made first (a nuqs filter's replaceState) would land on the sheet's entry
     * and be popped away with it. So: close, let the overlays settle, then call onChange.
     */
    const pending = useRef<{ value: Dayjs } | null>(null);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    const afterSettle = useAfterOverlaysSettle();
    useEffect(() => {
        if (open || !pending.current) return;
        const next = pending.current.value;
        pending.current = null;
        afterSettle(() => onChangeRef.current(next));
    }, [ open, afterSettle ]);

    const step = Math.max(1, minuteStep);
    const stepMinutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
    const baseDay = (day: string | null) => (kind === "time" ? (value ? value : null) : day ? dayValue(day) : null);
    const timeRules = (day: string | null) => {
        const config = disabledTime?.(baseDay(day));
        return {
            hours: config?.disabledHours?.() ?? [],
            minutes: (hour: number) => config?.disabledMinutes?.(hour) ?? [],
        };
    };
    const hourOff = (day: string | null, hour: number) => {
        const rules = timeRules(day);
        if (!hours.includes(hour) || rules.hours.includes(hour)) return true;
        const off = new Set(rules.minutes(hour));
        return stepMinutes.every((m) => off.has(m));
    };
    const dayOff = (day: string) => disabledDate?.(dayValue(day)) ?? false;

    /** Keeps a drafted time only while the drafted day still allows it. */
    const fitTime = (day: string | null, hour: number | null, minute: number | null): Draft => {
        if (hour === null) return { day, hour: null, minute: null };
        if (hourOff(day, hour)) return { day, hour: null, minute: null };
        if (minute !== null && timeRules(day).minutes(hour).includes(minute)) return { day, hour, minute: null };
        return { day, hour, minute };
    };

    const openSheet = () => {
        const day = value ? value.format("YYYY-MM-DD") : null;
        const start: Draft = { day, hour: value ? value.hour() : null, minute: value ? value.minute() : null };
        setDraft(start);
        setInitial(start);
        setView(kind === "time" ? "time" : "date");
        const shown = day ? day.slice(0, 7) : initialMonth ?? today.slice(0, 7);
        setMonth(minMonth && shown < minMonth ? minMonth : maxMonth && shown > maxMonth ? maxMonth : shown);
        setOpen(true);
    };

    const build = (d: Draft): Dayjs => {
        const day = kind === "time" ? (value ?? dayValue(today)).format("YYYY-MM-DD") : d.day!;
        const time = kind === "date" ? "00:00" : `${pad(d.hour!)}:${pad(d.minute!)}`;
        return dayjs.utc(`${day}T${time}:00`);
    };
    const unchanged = (d: Draft) =>
        (kind === "time" || d.day === initial.day) &&
        (kind === "date" || (d.hour === initial.hour && d.minute === initial.minute));
    const commit = (d: Draft) => {
        setOpen(false);
        // Re-saving the value it opened with would not be a no-op: on a fall-back night the second 01:30 would come
        // back as the first, an hour earlier, and the appointment picker would re-run its booked/blocked checks.
        if (value && unchanged(d)) return;
        pending.current = { value: build(d) };
    };

    const complete =
        (kind === "time" || (draft.day !== null && !dayOff(draft.day))) &&
        (kind === "date" || (draft.hour !== null && draft.minute !== null && !hourOff(draft.day, draft.hour)
            && !timeRules(draft.day).minutes(draft.hour).includes(draft.minute)));

    const showView = (next: "date" | "time") => {
        setView(next);
        (next === "date" ? dateTab : timeTab).current?.focus();
    };
    const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
        const next = TAB_KEYS[e.key];
        if (!next) return;
        e.preventDefault();
        showView(next);
    };

    const selectDay = (day: string) => {
        if (kind === "date") {
            commit({ day, hour: null, minute: null });
            return;
        }
        setDraft(fitTime(day, draft.hour, draft.minute));
        showView("time");
    };
    const selectHour = (hour: number) => {
        const keep = draft.minute !== null && !timeRules(draft.day).minutes(hour).includes(draft.minute);
        setDraft({ ...draft, hour, minute: keep ? draft.minute : null });
    };

    const text = value ? value.format(format) : placeholder ?? "";
    const Icon = kind === "time" ? Clock : CalendarDays;

    const calendar = (
        <MonthGrid
            month={month}
            selected={draft.day}
            today={today}
            isDisabled={dayOff}
            minMonth={minMonth}
            maxMonth={maxMonth}
            years={years}
            onSelect={selectDay}
            onMonth={setMonth}
        />
    );
    const chips = (
        <TimeChips
            hour={draft.hour}
            minute={draft.minute}
            minuteStep={step}
            hours={hours}
            disabledHours={timeRules(draft.day).hours}
            disabledMinutes={timeRules(draft.day).minutes}
            onHour={selectHour}
            onMinute={(minute) => setDraft({ ...draft, minute })}
        />
    );

    // A date-only sheet confirms on the tap, so it has nothing for "Listo" to do.
    const footer = (
        <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            {kind !== "date" && (
                <button type="button" className="btn-primary" disabled={!complete} onClick={() => commit(draft)}>Listo</button>
            )}
        </>
    );


    const sheet = open && (
        <Sheet title={title} onClose={() => setOpen(false)} footer={footer} stacked size="compact"
            testId={testId ? `${testId}-sheet` : undefined}>
            <div className={styles.sheetBody}>
                {kind === "dateTime" ? (
                    <>
                        <div role="tablist" aria-label={title} className={styles.tabs}>
                            <button ref={dateTab} id={dateTabId} type="button" role="tab" aria-selected={view === "date"}
                                aria-controls={panelId} tabIndex={view === "date" ? 0 : -1}
                                className={styles.tab} onClick={() => setView("date")} onKeyDown={onTabKey}>
                                <span className={styles.tabLabel}>Fecha</span>
                                <span className={styles.tabValue}>{draft.day ? fmtTabDay(draft.day) : "Elige un día"}</span>
                            </button>
                            <button ref={timeTab} id={timeTabId} type="button" role="tab" aria-selected={view === "time"}
                                aria-controls={panelId} tabIndex={view === "time" ? 0 : -1}
                                className={styles.tab} onClick={() => setView("time")} onKeyDown={onTabKey}>
                                <span className={styles.tabLabel}>Hora</span>
                                <span className={styles.tabValue}>
                                    {draft.hour === null ? "--:--" : `${pad(draft.hour)}:${draft.minute === null ? "--" : pad(draft.minute)}`}
                                </span>
                            </button>
                        </div>
                        <div role="tabpanel" id={panelId} aria-labelledby={view === "date" ? dateTabId : timeTabId}
                            className={styles.panel}>
                            {view === "date" ? calendar : chips}
                        </div>
                    </>
                ) : kind === "date" ? calendar : chips}
            </div>
        </Sheet>
    );

    return (
        <div className={`${styles.field}${className ? ` ${className}` : ""}`} style={style}>
            {/* aria-invalid is no longer global in ARIA 1.2, but screen readers still announce it on a button. */}
            {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
            <button
                ref={trigger}
                type="button"
                className={`${styles.trigger}${invalid ? ` ${styles.triggerInvalid}` : ""}`}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-invalid={invalid || undefined}
                aria-label={ariaLabel ? `${ariaLabel}, ${text}` : undefined}
                aria-describedby={labelled && !ariaLabel ? valueId : undefined}
                data-testid={testId}
                onClick={openSheet}
            >
                <span id={valueId} className={value ? styles.triggerValue : styles.triggerPlaceholder}>{text}</span>
                {!(allowClear && value) && <Icon size={16} aria-hidden="true" className={styles.triggerIcon} />}
            </button>
            {allowClear && value && !disabled && (
                <button type="button" className={styles.clear} aria-label="Borrar" onClick={() => onChange(null)}>
                    <X size={16} aria-hidden="true" />
                </button>
            )}
            {/* In a header filter pop-up the sheet renders inside it, so its taps count as inside. The pop-up
                (.th-filter-popover) must then never get transform, filter or contain: any of them would make it the
                containing block of the sheet's fixed scrim and shrink the scrim to the pop-up. */}
            {sheet && typeof document !== "undefined" && createPortal(sheet, popupContainer?.() ?? document.body)}
        </div>
    );
}
