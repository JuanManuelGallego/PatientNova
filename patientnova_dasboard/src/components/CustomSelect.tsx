"use client";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { SELECT_ICONS } from "@/src/config/icons";

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
  disabled?: boolean;
  "aria-label"?: string;
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
  disabled,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel =
    selected?.triggerLabel ?? selected?.label ?? placeholder ?? "";
  const isPlaceholder = !selected;

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownMaxHeight = 240;

    if (
      spaceBelow >= Math.min(dropdownMaxHeight, 120) ||
      spaceBelow >= spaceAbove
    ) {
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        right: "auto",
        zIndex: 9999,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        top: "auto",
        left: rect.left,
        width: rect.width,
        right: "auto",
        zIndex: 9999,
      });
    }
  }, []);

  const openWithHighlight = useCallback(() => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlightIdx(idx >= 0 ? idx : 0);
    setOpen(true);
  }, [options, value, disabled]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useLayoutEffect(() => {
    if (open) updateDropdownPosition();
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;

    function handleScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleResize() {
      setOpen(false);
    }

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (!open) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          openWithHighlight();
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIdx((i) => Math.min(i + 1, options.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (highlightIdx >= 0 && !options[highlightIdx]?.disabled) {
            onChange(options[highlightIdx].value);
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, highlightIdx, options, onChange, openWithHighlight, disabled],
  );

  const dropdown = open ? (
    <div
      className="custom-select__dropdown"
      role="listbox"
      style={dropdownStyle}
      ref={dropdownRef}
    >
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
          {o.value === value && (
            <span className="custom-select__check">
              <SELECT_ICONS.check size={14} />
            </span>
          )}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div
      className={`custom-select${disabled ? " custom-select--disabled" : ""} ${className ?? ""}`}
      ref={ref}
      onKeyDown={handleKeyDown}
      style={disabled ? { opacity: 0.45, userSelect: "none" } : undefined}
    >
      <button
        type="button"
        role="combobox"
        aria-controls="custom-select__dropdown"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-disabled={disabled}
        disabled={disabled}
        ref={triggerRef}
        className={`custom-select__trigger${isPlaceholder ? " custom-select__trigger--placeholder" : ""}`}
        style={
          disabled
            ? { cursor: "not-allowed", filter: "grayscale(0.3)" }
            : undefined
        }
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (open) setOpen(false);
          else openWithHighlight();
        }}
      >
        <span className="custom-select__label">{displayLabel}</span>
        <svg
          className={`custom-select__chevron${open ? " custom-select__chevron--open" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
