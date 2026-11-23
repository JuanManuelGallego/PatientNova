"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { Sheet } from "@/src/components/Sheet/Sheet";
import { useAfterOverlaysSettle } from "@/src/hooks/useFocusTrap";
import { useCoarsePointer } from "@/src/hooks/useCoarsePointer";
import { useTimeFormat } from "./TimeFormat";
import { TimeList, moveActive, optionId, startIndex } from "./TimeList";
import {
    END_OF_DAY,
    conflictAt,
    formatDuration,
    formatTime,
    parseTime,
    resolveRules,
    timeOptions,
    timeProblem,
    toMinutes,
    toTimeValue,
    type TimeFormat,
    type TimeRules,
} from "./timeRules";
import styles from "./Pickers.module.css";

export interface TimeFieldProps extends TimeRules {
    value: string | null;
    onChange: (value: string | null) => void;
    from?: string | null;
    hint?: "end" | "duration" | ((value: string) => ReactNode);
    format?: TimeFormat;
    ariaLabel?: string;
    title?: string;
    id?: string;
    placeholder?: string;
    allowClear?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    testId?: string;
    className?: string;
    style?: CSSProperties;
}

const POPOVER_HEIGHT = 280;

export function TimeField(props: TimeFieldProps) {
    const {
        value, onChange, from = null, hint, format: formatProp, ariaLabel, title, id, placeholder, allowClear = false,
        disabled, invalid, testId, className, style, ...ruleProps
    } = props;
    const format = useTimeFormat(formatProp);
    const rules = resolveRules(ruleProps);
    const current = value === null ? null : toMinutes(value);
    const start = from === null ? null : toMinutes(from);
    const options = timeOptions(rules, start);
    const coarse = useCoarsePointer();

    const listId = useId();
    const noteId = useId();
    const sheetNoteId = useId();
    const [ open, setOpen ] = useState(false);
    const [ active, setActive ] = useState(-1);
    const [ typed, setTyped ] = useState<string | null>(null);
    const [ sheetTyped, setSheetTyped ] = useState("");
    const [ sheetError, setSheetError ] = useState<string | null>(null);
    const box = useRef<HTMLInputElement>(null);

    const read = (text: string) => {
        const minutes = parseTime(text);
        return minutes === 0 && ruleProps.endOfDay && start !== null ? END_OF_DAY : minutes;
    };
    const shown = current === null ? "" : formatTime(current, format);
    const typedProblem = typed !== null && typed.trim() !== "" ? timeProblem(rules, read(typed), { from: start, format }) : null;

    const note: { text: ReactNode; tone: "plain" | "warn" | "error" } | null = (() => {
        if (typedProblem) return { text: typedProblem, tone: "error" };
        if (current === null) return null;
        const span = conflictAt(rules, current);
        if (span) return { text: span.detail ?? span.label, tone: "warn" };
        if (hint === "end") return rules.duration ? { text: `Termina ${formatTime(current + rules.duration, format)}`, tone: "plain" } : null;
        if (hint === "duration") return start !== null && current > start ? { text: formatDuration(current - start), tone: "plain" } : null;
        if (typeof hint === "function" && value !== null) return { text: hint(value), tone: "plain" };
        return null;
    })();

    const pending = useRef<{ value: string } | null>(null);
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

    const emit = (minutes: number) => {
        if (minutes !== current) onChange(toTimeValue(minutes));
    };


    const openList = () => {
        if (open || disabled) return;
        setActive(startIndex(options, current));
        setOpen(true);
    };
    const closeList = () => {
        setOpen(false);
        setActive(-1);
    };
    const pick = (minutes: number) => {
        setTyped(null);
        closeList();
        emit(minutes);
    };
    const commitTyped = (onInvalid: "keep" | "revert") => {
        if (typed === null) return;
        const text = typed.trim();
        if (text === "") {
            setTyped(null);
            if (allowClear && value !== null) onChange(null);
            return;
        }
        const minutes = read(text);
        if (minutes !== null && minutes === current) {
            setTyped(null);
            closeList();
            return;
        }
        if (minutes === null || timeProblem(rules, minutes, { from: start, format })) {
            if (onInvalid === "revert") setTyped(null);
            return;
        }
        setTyped(null);
        closeList();
        emit(minutes);
    };

    const onBoxKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
                openList();
                return;
            }
            setActive((i) => (i < 0 ? startIndex(options, current) : moveActive(options, i, e.key === "ArrowDown" ? 1 : -1)));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (typed !== null && typed.trim() !== shown) commitTyped("keep");
            else if (open && active >= 0 && !options[active]?.unavailable) pick(options[active].minutes);
            else closeList();
        } else if (e.key === "Escape" && (open || typed !== null)) {
            e.preventDefault();
            e.stopPropagation();
            setTyped(null);
            closeList();
        } else if (e.key === "Tab") {
            closeList();
        }
    };

    const onBoxInput = (text: string) => {
        setTyped(text);
        if (!open) setOpen(true);
        const minutes = read(text);
        if (minutes !== null) setActive(startIndex(options, minutes));
    };

    const [ place, setPlace ] = useState<CSSProperties>({});
    useLayoutEffect(() => {
        if (!open || coarse) return;
        const update = () => {
            const rect = box.current?.getBoundingClientRect();
            if (!rect) return;
            const below = window.innerHeight - rect.bottom;
            const next: CSSProperties = {
                left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 200) - 8)),
                minWidth: Math.max(rect.width, 200),
            };
            if (below < POPOVER_HEIGHT && rect.top > below) next.bottom = window.innerHeight - rect.top + 4;
            else next.top = rect.bottom + 4;
            setPlace(next);
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [ open, coarse ]);

    const noteEl = (
        <span id={noteId} className={`${styles.timeNote}${note?.tone === "warn" ? ` ${styles.timeNoteWarn}` : note?.tone === "error" ? ` ${styles.timeNoteError}` : ""}`}
            aria-live="polite">
            {note?.text}
        </span>
    );

    const clear = allowClear && value !== null && !disabled && (
        <button type="button" className={styles.timeClear} aria-label="Borrar" onClick={() => { setTyped(null); onChange(null); }}>
            <X size={16} aria-hidden="true" />
        </button>
    );

    if (!coarse) {
        return (
            <div className={`${styles.timeField}${className ? ` ${className}` : ""}`} style={style}>
                <div className={styles.timeControl}>
                    <input
                        ref={box}
                        id={id}
                        type="text"
                        role="combobox"
                        inputMode={format === "24h" ? "numeric" : "text"}
                        autoComplete="off"
                        className={`${styles.timeBox}${invalid || typedProblem ? ` ${styles.timeBoxInvalid}` : ""}${clear ? ` ${styles.timeBoxClearable}` : ""}`}
                        value={typed ?? shown}
                        placeholder={placeholder}
                        disabled={disabled}
                        aria-label={ariaLabel}
                        aria-invalid={invalid || !!typedProblem || undefined}
                        aria-describedby={noteId}
                        aria-expanded={open}
                        aria-controls={open ? listId : undefined}
                        aria-autocomplete="list"
                        aria-activedescendant={open && active >= 0 ? optionId(listId, active) : undefined}
                        data-testid={testId}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={openList}
                        onChange={(e) => onBoxInput(e.target.value)}
                        onKeyDown={onBoxKey}
                        onBlur={() => { closeList(); commitTyped("revert"); }}
                    />
                    {clear}
                </div>
                {noteEl}
                {open && typeof document !== "undefined" && createPortal(
                    <div className={styles.timePopover} style={place} data-testid={testId ? `${testId}-list` : undefined}>
                        <TimeList id={listId} label={ariaLabel ?? title ?? "Horas"} options={options} selected={current}
                            active={active} format={format} onPick={pick} variant="popover" />
                    </div>,
                    document.body,
                )}
            </div>
        );
    }


    const openSheet = () => {
        setSheetTyped("");
        setSheetError(null);
        setActive(startIndex(options, current));
        setOpen(true);
    };
    const choose = (minutes: number) => {
        setOpen(false);
        if (minutes !== current) pending.current = { value: toTimeValue(minutes) };
    };
    const commitSheetTyped = () => {
        const minutes = read(sheetTyped);
        const problem = timeProblem(rules, minutes, { from: start, format });
        if (problem || minutes === null) {
            setSheetError(problem);
            return;
        }
        choose(minutes);
    };
    const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => moveActive(options, i, e.key === "ArrowDown" ? 1 : -1));
        } else if ((e.key === "Enter" || e.key === " ") && active >= 0 && !options[active]?.unavailable) {
            e.preventDefault();
            choose(options[active].minutes);
        }
    };
    const sheetTitle = title ?? ariaLabel ?? "Hora";

    return (
        <div className={`${styles.timeField}${className ? ` ${className}` : ""}`} style={style}>
            <div className={styles.timeControl}>
                {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
                <button
                    type="button"
                    id={id}
                    className={`${styles.trigger}${invalid ? ` ${styles.triggerInvalid}` : ""}`}
                    disabled={disabled}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-invalid={invalid || undefined}
                    aria-label={ariaLabel ? `${ariaLabel}, ${shown || placeholder || ""}` : undefined}
                    aria-describedby={noteId}
                    data-testid={testId}
                    onClick={openSheet}
                >
                    <span className={shown ? styles.triggerValue : styles.triggerPlaceholder}>{shown || placeholder}</span>
                    {!clear && <Clock size={16} aria-hidden="true" className={styles.triggerIcon} />}
                </button>
                {clear}
            </div>
            {noteEl}
            {open && typeof document !== "undefined" && createPortal(
                <Sheet title={sheetTitle} onClose={() => setOpen(false)} stacked size="compact" testId={testId ? `${testId}-sheet` : undefined}>
                    <div className={styles.timeSheet}>
                        <div className={styles.timeSheetType}>
                            <input
                                type="text"
                                inputMode={format === "24h" ? "numeric" : "text"}
                                autoComplete="off"
                                className={`${styles.timeBox}${sheetError ? ` ${styles.timeBoxInvalid}` : ""}`}
                                value={sheetTyped}
                                placeholder={`Escribe otra hora, p. ej. ${format === "12h" ? "9:35 a. m." : "9:35"}`}
                                aria-label="Escribir la hora"
                                aria-invalid={!!sheetError || undefined}
                                aria-describedby={sheetNoteId}
                                onChange={(e) => { setSheetTyped(e.target.value); setSheetError(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitSheetTyped(); } }}
                            />
                            <span id={sheetNoteId} className={`${styles.timeNote}${sheetError ? ` ${styles.timeNoteError}` : ""}`}>
                                {sheetError ?? "Enter para usarla"}
                            </span>
                        </div>
                        <TimeList id={listId} label={sheetTitle} options={options} selected={current} active={active}
                            format={format} onPick={choose} variant="sheet" onKeyDown={onListKey} />
                    </div>
                </Sheet>,
                document.body,
            )}
        </div>
    );
}
