"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { CalendarDays, X } from "lucide-react";
import { Sheet } from "@/src/components/Sheet/Sheet";
import { useAfterOverlaysSettle } from "@/src/hooks/useFocusTrap";
import { useCoarsePointer } from "@/src/hooks/useCoarsePointer";
import { MonthGrid } from "./MonthGrid";
import styles from "./Pickers.module.css";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export interface PickerFieldProps {
    value: Dayjs | null;
    onChange: (value: Dayjs | null) => void;
    today: string;
    format: string;
    placeholder?: string;
    title: string;
    disabledDate?: (day: Dayjs) => boolean;
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

const dayValue = (day: string) => dayjs.utc(`${day}T00:00:00`);
/** Accepts the field format and its single-digit form (5/3/2026). */
const lenientFormats = (format: string) => [ format, format.replace("DD", "D").replace("MM", "M") ];

export function PickerField(props: PickerFieldProps) {
    const {
        value, onChange, today, format, placeholder, title, disabledDate, minMonth, maxMonth, initialMonth, years,
        allowClear = false, disabled, invalid, ariaLabel, popupContainer, testId, className, style,
    } = props;
    const [ open, setOpen ] = useState(false);
    const [ month, setMonth ] = useState(today.slice(0, 7));
    const valueId = useId();
    const hintId = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const coarse = useCoarsePointer();
    const [ typed, setTyped ] = useState<string | null>(null);
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

    const dayOff = (day: string) => disabledDate?.(dayValue(day)) ?? false;
    const current = value ? value.format("YYYY-MM-DD") : null;

    const openSheet = () => {
        const shown = current ? current.slice(0, 7) : initialMonth ?? today.slice(0, 7);
        setMonth(minMonth && shown < minMonth ? minMonth : maxMonth && shown > maxMonth ? maxMonth : shown);
        setOpen(true);
    };

    const selectDay = (day: string) => {
        setOpen(false);
        if (day !== current) pending.current = { value: dayValue(day) };
    };

    // Typed text -> a day that passes the same rules as the sheet, or null.
    const parseTyped = (text: string): string | null => {
        const parsed = lenientFormats(format).map((f) => dayjs.utc(text.trim(), f, true)).find((d) => d.isValid());
        if (!parsed) return null;
        const day = parsed.format("YYYY-MM-DD");
        return dayOff(day) ? null : day;
    };
    const commitTyped = () => {
        if (typed === null) return;
        const text = typed.trim();
        setTyped(null);
        if (text === "") {
            if (allowClear && value) onChange(null);
            return;
        }
        const day = parseTyped(text);
        if (day && day !== current) onChange(dayValue(day));
    };
    const typedInvalid = typed !== null && typed.trim() !== "" && parseTyped(typed) === null;

    const text = value ? value.format(format) : placeholder ?? "";

    const sheet = open && (
        <Sheet title={title} onClose={() => setOpen(false)} stacked size="compact"
            footer={<button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>}
            testId={testId ? `${testId}-sheet` : undefined}>
            <div className={styles.sheetBody}>
                <MonthGrid
                    month={month}
                    selected={current}
                    today={today}
                    isDisabled={dayOff}
                    minMonth={minMonth}
                    maxMonth={maxMonth}
                    years={years}
                    onSelect={selectDay}
                    onMonth={setMonth}
                    autoFocus={!coarse}
                />
            </div>
        </Sheet>
    );

    if (!coarse) {
        const shown = typed ?? (value ? value.format(format) : "");
        const hint = format.replace("DD", "dd").replace("MM", "mm").replace("YYYY", "aaaa");
        return (
            <div className={`${styles.field}${className ? ` ${className}` : ""}`} style={style}>
                <input
                    type="text"
                    className={`${styles.input}${invalid || typedInvalid ? ` ${styles.triggerInvalid}` : ""}`}
                    value={shown}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete="off"
                    aria-label={ariaLabel}
                    aria-invalid={invalid || typedInvalid || undefined}
                    aria-describedby={hintId}
                    data-testid={testId}
                    onChange={(e) => setTyped(e.target.value)}
                    onBlur={commitTyped}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            commitTyped();
                        } else if (e.key === "Escape" && typed !== null) {
                            e.stopPropagation();
                            setTyped(null);
                        }
                    }}
                />
                <span id={hintId} hidden>Formato {hint}</span>
                {allowClear && value && !disabled && (
                    <button type="button" className={`${styles.clear} ${styles.clearBeside}`} aria-label="Borrar"
                        onClick={() => onChange(null)}>
                        <X size={16} aria-hidden="true" />
                    </button>
                )}
                <button type="button" className={styles.openButton} disabled={disabled}
                    aria-haspopup="dialog" aria-expanded={open} aria-label="Abrir calendario"
                    data-testid={testId ? `${testId}-open` : undefined}
                    onClick={openSheet}>
                    <CalendarDays size={16} aria-hidden="true" />
                </button>
                {sheet && typeof document !== "undefined" && createPortal(sheet, popupContainer?.() ?? document.body)}
            </div>
        );
    }

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
                {!(allowClear && value) && <CalendarDays size={16} aria-hidden="true" className={styles.triggerIcon} />}
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
