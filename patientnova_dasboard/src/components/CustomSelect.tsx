"use client";
import { useState, useRef, useEffect, useCallback } from "react";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
    triggerLabel?: string;
}

interface CustomSelectProps {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
}

export function CustomSelect({ value, options, onChange, placeholder, className, "aria-label": ariaLabel }: CustomSelectProps) {
    const [ open, setOpen ] = useState(false);
    const [ highlightIdx, setHighlightIdx ] = useState(-1);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.value === value);
    const displayLabel = selected?.triggerLabel ?? selected?.label ?? placeholder ?? "";
    const isPlaceholder = !selected;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        if (open) {
            const idx = options.findIndex(o => o.value === value);
            setHighlightIdx(idx >= 0 ? idx : 0);
        }
    }, [ open, options, value ]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!open) {
            if ([ "ArrowDown", "ArrowUp", "Enter", " " ].includes(e.key)) {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightIdx(i => Math.min(i + 1, options.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightIdx(i => Math.max(i - 1, 0));
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                if (highlightIdx >= 0 && !options[ highlightIdx ]?.disabled) {
                    onChange(options[ highlightIdx ].value);
                    setOpen(false);
                }
                break;
            case "Escape":
                e.preventDefault();
                setOpen(false);
                break;
        }
    }, [ open, highlightIdx, options, onChange ]);

    return (
        <div className={`custom-select ${className ?? ""}`} ref={ref} onKeyDown={handleKeyDown}>
            <button
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={ariaLabel}
                className={`custom-select__trigger${isPlaceholder ? " custom-select__trigger--placeholder" : ""}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(o => !o);
                }}
            >
                <span className="custom-select__label">{displayLabel}</span>
                <svg className={`custom-select__chevron${open ? " custom-select__chevron--open" : ""}`} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {open && (
                <div className="custom-select__dropdown" role="listbox">
                    {options.map((o, i) => (
                        <div
                            key={o.value}
                            role="option"
                            aria-selected={o.value === value}
                            className={`custom-select__option${o.value === value ? " custom-select__option--selected" : ""}${o.disabled ? " custom-select__option--disabled" : ""}${i === highlightIdx ? " custom-select__option--highlighted" : ""}`}
                            onClick={(e) => {
                                e.preventDefault();
                                if (o.disabled) return;
                                onChange(o.value);
                                setOpen(false);
                            }}
                        >
                            {o.label}
                            {o.value === value && <span className="custom-select__check">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
