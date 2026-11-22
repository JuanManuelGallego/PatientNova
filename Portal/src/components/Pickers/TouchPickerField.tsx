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

export interface DisabledTimeConfig {
    disabledHours?: () => number[];
    disabledMinutes?: (hour: number) => number[];
}

export interface TouchPickerFieldProps {
    kind: TouchPickerKind;
    value: Dayjs | null;
    onChange: (value: Dayjs | null) => void;
    today: string;
    format: string;
    placeholder?: string;
    title: string;
    disabledDate?: (day: Dayjs) => boolean;
    disabledTime?: (day: Dayjs | null) => DisabledTimeConfig | undefined;
    minuteStep?: number;
    hours?: number[];
    minMonth?: string;
    maxMonth?: string;
    initialMonth?: string;
    years?: { from: number; to: number };
    allowClear?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    ariaLabel?: string;
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
const TAB_KEYS: Record<string, "date" | "time"> = { ArrowLeft: "date", ArrowRight: "time", Home: "date", End: "time" };
const EMPTY: Draft = { day: null, hour: null, minute: null };
const fmtTabDay = (day: string) => dayValue(day).locale("es").format("ddd D MMM YYYY").replace(/\./g, "");

export function TouchPickerField(props: TouchPickerFieldProps) {
    const {
        kind, value, onChange, today, format, placeholder, title, disabledDate, disabledTime, minuteStep = 1,
        hours = ALL_HOURS, minMonth, maxMonth, initialMonth, years, allowClear = false, disabled, invalid, ariaLabel,
        popupContainer, testId, className, style,
    } = props;
    const [ open, setOpen ] = useState(false);
    const [ draft, setDraft ] = useState<Draft>(EMPTY);
    const [ initial, setInitial ] = useState<Draft>(EMPTY);
    const [ view, setView ] = useState<"date" | "time">("date");
    const [ month, setMonth ] = useState(today.slice(0, 7));
    const panelId = useId();
    const valueId = useId();
    const dateTabId = useId();
    const timeTabId = useId();
    const dateTab = useRef<HTMLButtonElement>(null);
    const timeTab = useRef<HTMLButtonElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [ labelled, setLabelled ] = useState(false);
    useEffect(() => {
        setLabelled((trigger.current?.labels?.length ?? 0) > 0);
    }, []);

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
            {sheet && typeof document !== "undefined" && createPortal(sheet, popupContainer?.() ?? document.body)}
        </div>
    );
}
