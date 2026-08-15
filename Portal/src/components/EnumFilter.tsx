"use client";
import React from "react";
import { ACTION_ICONS, SELECT_ICONS } from "@/src/config/icons";
import { SelectOption } from "./CustomSelect";

export interface EnumFilterProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Clears all selected values. */
  onClear?: () => void;
  /** When true, behaves as a single-select (clicking an option replaces the selection, and the "All" option is selectable). */
  single?: boolean;
  /** Hidden test id for the checklist container. */
  testId?: string;
  /** Label used for the clear button when no empty-option label exists. */
  clearLabel?: string;
}

export function EnumFilter({
  options,
  value,
  onChange,
  onClear,
  single = false,
  testId,
  clearLabel = "Limpiar",
}: EnumFilterProps) {
  const clear = () => {
    if (onClear) onClear();
    else onChange([]);
  };

  const handleClick = (o: SelectOption) => {
    if (single) {
      onChange(o.value === "" ? [] : [o.value]);
      return;
    }
    const selected = value.includes(o.value);
    onChange(
      selected ? value.filter((v) => v !== o.value) : [...value, o.value],
    );
  };

  return (
    <div
      className="enum-filter"
      data-testid={testId}
      role={single ? "radiogroup" : "listbox"}
    >
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <div
            key={o.value}
            role={single ? "radio" : "option"}
            aria-selected={selected}
            aria-checked={single ? selected : undefined}
            className={`custom-select__option${selected ? " custom-select__option--selected" : ""}`}
            onClick={() => handleClick(o)}
          >
            <span>{o.label}</span>
            {selected && (
              <span className="custom-select__check">
                <SELECT_ICONS.check size={14} />
              </span>
            )}
          </div>
        );
      })}
      {value.length > 0 && (
        <button
          type="button"
          className="btn-secondary btn-secondary--sm enum-filter__clear"
          onClick={clear}
          style={{display: "flex", alignItems: "center", gap: 6}}
        >
          <ACTION_ICONS.close size={12} />{" "}
          {options.find((o) => o.value === "")?.label ?? clearLabel}
        </button>
      )}
    </div>
  );
}
