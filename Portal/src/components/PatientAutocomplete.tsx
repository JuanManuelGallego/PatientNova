"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
import { useDebounceState } from "@/src/hooks/useDebounceState";
import { getPatientFullName } from "@/src/utils/AvatarHelper";
import { SELECT_ICONS, ACTION_ICONS } from "@/src/config/icons";
import { Patient } from "@/src/types/Patient";

interface PatientAutocompleteProps {
  value: string;
  onChange: (patientId: string, patient?: Patient) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function PatientAutocomplete({
  value,
  onChange,
  placeholder = "Buscar paciente…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: PatientAutocompleteProps) {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounceState(searchText, 250);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      page: 0,
    }),
    [debouncedSearch],
  );

  const { patients, loading } = useFetchPatients(filters);

  const selectedPatient = patients.find((p) => p.id === value);

  const displayValue =
    isSearching || !selectedPatient ? searchText : getPatientFullName(selectedPatient);

  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setOpen(false);
        setIsSearching(false);
      }
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

  const handleFocus = useCallback(() => {
    if (disabled) return;
    setIsSearching(true);
    setSearchText("");
    setOpen(true);
    setHighlightIdx(0);
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setSearchText(text);
      setIsSearching(true);
      setHighlightIdx(0);
    },
    [],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      setSearchText("");
      setIsSearching(true);
      setHighlightIdx(0);
      onChange("");
      inputRef.current?.focus();
    },
    [disabled, onChange],
  );

  const handleOptionClick = useCallback(
    (patientId: string) => {
      const patient = patients.find((p) => p.id === patientId);
      onChange(patientId, patient);
      setSearchText("");
      setIsSearching(false);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange, patients],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!open) {
        if (["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          setIsSearching(true);
          setSearchText("");
          setOpen(true);
          setHighlightIdx(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIdx((i) => Math.min(i + 1, patients.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIdx >= 0 && patients[highlightIdx]) {
            handleOptionClick(patients[highlightIdx].id);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setIsSearching(false);
          setSearchText("");
          break;
      }
    },
    [disabled, open, highlightIdx, patients, handleOptionClick],
  );

  const showDropdown = open && (loading || patients.length > 0 || debouncedSearch.trim());

  const dropdown = showDropdown ? (
    <div
      id="patient-autocomplete__listbox"
      className="custom-select__dropdown"
      role="listbox"
      style={dropdownStyle}
      ref={dropdownRef}
    >
      {patients.length > 0 ? (
        patients.map((patient, i) => {
          const isSelected = patient.id === value;
          return (
            <div
              key={patient.id}
              role="option"
              aria-selected={isSelected}
              className={`patient-autocomplete__option${isSelected ? " patient-autocomplete__option--selected" : ""}${i === highlightIdx ? " patient-autocomplete__option--highlighted" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handleOptionClick(patient.id);
              }}
            >
              <span className="patient-autocomplete__name">
                {getPatientFullName(patient)}
              </span>
              {isSelected && (
                <span className="custom-select__check">
                  <SELECT_ICONS.check size={14} />
                </span>
              )}
            </div>
          );
        })
      ) : (
        <div className="patient-autocomplete__empty">
          <ACTION_ICONS.search size={14} />
          Sin resultados
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`patient-autocomplete${disabled ? " patient-autocomplete--disabled" : ""} ${className ?? ""}`}
      ref={ref}
      onKeyDown={handleKeyDown}
      style={disabled ? { opacity: 0.45, userSelect: "none" } : undefined}
    >
      <div
        className={`patient-autocomplete__trigger${!displayValue && !isSearching ? " patient-autocomplete__trigger--placeholder" : ""}`}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className="patient-autocomplete__input"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls="patient-autocomplete__listbox"
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
          onFocus={handleFocus}
          onChange={handleChange}
        />
        {!isSearching && value && (
          <button
            type="button"
            className="patient-autocomplete__clear"
            tabIndex={-1}
            aria-label="Limpiar selección"
            onClick={handleClear}
          >
            <ACTION_ICONS.close size={14} />
          </button>
        )}
        {isSearching && loading && (
          <span className="patient-autocomplete__spinner">
            <ACTION_ICONS.loader size={14} className="patient-autocomplete__spinner-icon" />
          </span>
        )}
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
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
