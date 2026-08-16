"use client";
import React from "react";
import { SELECT_ICONS } from "@/src/config/icons";
import { SelectOption } from "./CustomSelect";

export interface EnumFilterProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** When true, behaves as a single-select (radio). Otherwise multi-select (checkbox). */
  single?: boolean;
  /** Hidden test id for the checklist container. */
  testId?: string;
}

export function EnumFilter({
  options,
  value,
  onChange,
  single = false,
  testId,
}: EnumFilterProps) {
  const handleClick = (o: SelectOption) => {
    if (o.value === "") {
      // "All" choice clears the selection.
      onChange([]);
      return;
    }
    if (single) {
      onChange([o.value]);
      return;
    }
    const selected = value.includes(o.value);
    onChange(
      selected ? value.filter((v) => v !== o.value) : [...value, o.value],
    );
  };

  const isSelected = (o: SelectOption) =>
    o.value === "" ? value.length === 0 : value.includes(o.value);

  return (
    <div
      className="enum-filter"
      data-testid={testId}
      role={single ? "radiogroup" : "listbox"}
    >
      {options.map((o) => {
        const selected = isSelected(o);
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
    </div>
  );
}
