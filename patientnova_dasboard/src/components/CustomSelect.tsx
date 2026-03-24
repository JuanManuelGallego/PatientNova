"use client";
import { useState, useRef, useEffect } from "react";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface CustomSelectProps {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function CustomSelect({ value, options, onChange, placeholder, className }: CustomSelectProps) {
    const [ open, setOpen ] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.value === value);
    const displayLabel = selected?.label ?? placeholder ?? "";
    const isPlaceholder = !selected;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div className={`custom-select ${className ?? ""}`} ref={ref}>
            <button
                type="button"
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
                <div className="custom-select__dropdown">
                    {options.map(o => (
                        <div
                            key={o.value}
                            className={`custom-select__option${o.value === value ? " custom-select__option--selected" : ""}${o.disabled ? " custom-select__option--disabled" : ""}`}
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
