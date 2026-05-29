"use client";

import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";

interface FilterBarProps {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  placeholder?: string;
  wrap?: boolean;
  children?: React.ReactNode;
}

export function FilterBar({
  value,
  onChange,
  onClear,
  placeholder = "Buscar…",
  wrap = false,
  children,
}: FilterBarProps) {
  const XIcon = ACTION_ICONS.close;
  const SearchIcon = STATUS_ICONS.search;
  return (
    <div className={`filter-bar${wrap ? " filter-bar--wrap" : ""}`}>
      <div className="search-wrapper">
        <span className="search-wrapper__icon">
          <SearchIcon size={16} />
        </span>
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input form-input--search"
          autoComplete="off"
        />
        {value && (
          <button
            onClick={onClear}
            className="search-clear-btn"
            aria-label="Limpiar búsqueda"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
