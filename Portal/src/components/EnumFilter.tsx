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
  testId,
  clearLabel = "Limpiar",
}: EnumFilterProps) {
  const clear = () => {
    if (onClear) onClear();
    else onChange([]);
  };

  return (
    <div className="enum-filter" data-testid={testId} role="listbox">
      {options
        .filter((o) => o.value !== "")
        .map((o) => {
          const selected = value.includes(o.value);
          return (
            <div
              key={o.value}
              role="option"
              aria-selected={selected}
              className={`custom-select__option${selected ? " custom-select__option--selected" : ""}`}
              onClick={() => {
                const next = selected
                  ? value.filter((v) => v !== o.value)
                  : [...value, o.value];
                onChange(next);
              }}
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
