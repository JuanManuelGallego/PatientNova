"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { END_OF_DAY, formatDuration, formatTime, type TimeFormat, type TimeOption } from "./timeRules";
import styles from "./Pickers.module.css";

export const optionId = (listId: string, index: number) => `${listId}-o${index}`;

function trailing(option: TimeOption): string | null {
    if (option.unavailable) return option.unavailable.label;
    if (option.minutes === END_OF_DAY) return "fin del día";
    if (option.duration !== undefined) return formatDuration(option.duration);
    return null;
}

export function optionLabel(option: TimeOption, format: TimeFormat): string {
    const extra = trailing(option);
    const time = formatTime(option.minutes, format);
    return extra ? `${time}, ${extra.toLowerCase()}` : time;
}

export function moveActive(options: TimeOption[], from: number, dir: 1 | -1): number {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
        if (!options[i].unavailable) return i;
    }
    return from;
}

export function startIndex(options: TimeOption[], selected: number | null): number {
    if (options.length === 0) return -1;
    if (selected === null) return Math.max(0, options.findIndex((o) => !o.unavailable));
    const at = options.findIndex((o) => o.minutes >= selected);
    return at === -1 ? options.length - 1 : at;
}

export interface TimeListProps {
    id: string;
    label: string;
    options: TimeOption[];
    selected: number | null;
    active: number;
    format: TimeFormat;
    onPick: (minutes: number) => void;
    variant: "popover" | "sheet";
    onKeyDown?: (e: KeyboardEvent<HTMLUListElement>) => void;
}

export function TimeList({ id, label, options, selected, active, format, onPick, variant, onKeyDown }: TimeListProps) {
    const list = useRef<HTMLUListElement>(null);
    const centred = useRef(false);

    useLayoutEffect(() => {
        const ul = list.current;
        const li = active >= 0 ? ul?.querySelector<HTMLElement>(`[data-index="${active}"]`) : null;
        if (!ul || !li) return;
        if (!centred.current) {
            ul.scrollTop = li.offsetTop - ul.clientHeight / 2 + li.offsetHeight / 2;
            centred.current = true;
        } else {
            li.scrollIntoView?.({ block: "nearest" });
        }
    }, [ active ]);

    return (
        <ul
            ref={list}
            id={id}
            role="listbox"
            aria-label={label}
            className={variant === "sheet" ? `${styles.timeList} ${styles.timeListSheet}` : styles.timeList}
            tabIndex={variant === "sheet" ? 0 : -1}
            data-autofocus={variant === "sheet" ? "" : undefined}
            aria-activedescendant={variant === "sheet" && active >= 0 ? optionId(id, active) : undefined}
            onKeyDown={onKeyDown}
        >
            {options.map((option, i) => {
                const extra = trailing(option);
                const classes = [ styles.timeOption ];
                if (i === active) classes.push(styles.timeOptionActive);
                if (i > 0 && option.minutes % 60 === 0 && option.duration === undefined) classes.push(styles.timeOptionHour);
                return (
                    <li
                        key={option.minutes}
                        id={optionId(id, i)}
                        data-index={i}
                        role="option"
                        aria-selected={option.minutes === selected}
                        aria-disabled={option.unavailable ? true : undefined}
                        aria-label={optionLabel(option, format)}
                        className={classes.join(" ")}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { if (!option.unavailable) onPick(option.minutes); }}
                    >
                        <span>{formatTime(option.minutes, format)}</span>
                        {extra && <small>{extra}</small>}
                    </li>
                );
            })}
        </ul>
    );
}
