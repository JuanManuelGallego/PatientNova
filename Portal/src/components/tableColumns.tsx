"use client";
import React from "react";
import { SelectOption } from "./CustomSelect";
import { DateTimePicker } from "./DateTimePicker";
import { DateRangePicker, type DateRangeValue } from "./DateRangePicker";
import { EnumFilter } from "./EnumFilter";

export type ColumnFilterConfig =
  | {
      kind: "enum";
      options: SelectOption[];
      value: string[];
      onChange: (value: string[]) => void;
      testId?: string;
      triggerTestId?: string;
    }
  | {
      kind: "date";
      value: string;
      onChange: (value: string) => void;
      testId?: string;
      triggerTestId?: string;
    }
  | {
      kind: "date-range";
      value: DateRangeValue;
      onChange: (value: DateRangeValue) => void;
      testId?: string;
      triggerTestId?: string;
    }
  | {
      kind: "single-enum";
      options: SelectOption[];
      value: string;
      onChange: (value: string) => void;
      testId?: string;
      triggerTestId?: string;
    }
  | {
      kind: "custom";
      render: (onClose: () => void) => React.ReactNode;
      active?: boolean;
      onClear?: () => void;
      testId?: string;
      triggerTestId?: string;
    };

export interface ColumnDef {
  label: string;
  sortKey?: string;
  filter?: ColumnFilterConfig;
  priority?: "secondary" | "actions";
}

export function isFilterActive(filter: ColumnFilterConfig | undefined): boolean {
  if (!filter) return false;
  switch (filter.kind) {
    case "custom":
      return Boolean(filter.active);
    case "enum":
      return filter.value.length > 0;
    case "date-range":
      return (
        filter.value !== null && filter.value[0] !== "" && filter.value[1] !== ""
      );
    default:
      return filter.value !== "";
  }
}

export function clearFilter(filter: ColumnFilterConfig): void {
  switch (filter.kind) {
    case "enum":
      filter.onChange([]);
      return;
    case "date-range":
      filter.onChange(null);
      return;
    case "custom":
      filter.onClear?.();
      return;
    default:
      filter.onChange("");
  }
}

export function FilterBody({
  config,
  onClose,
  onPicked,
  popupContainer,
}: {
  config: ColumnFilterConfig;
  onClose: () => void;
  onPicked?: () => void;
  popupContainer?: () => HTMLElement | null;
}) {
  switch (config.kind) {
    case "enum":
      return (
        <EnumFilter
          options={config.options}
          value={config.value}
          onChange={config.onChange}
          testId={config.testId}
        />
      );
    case "single-enum":
      return (
        <EnumFilter
          single
          options={config.options}
          value={config.value ? [config.value] : []}
          onChange={(next) => config.onChange(next[0] ?? "")}
          testId={config.testId}
        />
      );
    case "custom":
      return <>{config.render(onClose)}</>;
    case "date-range":
      return (
        <DateRangePicker
          value={config.value}
          popupContainer={popupContainer}
          onChange={(range) => {
            config.onChange(range);
            onPicked?.();
          }}
          testId={config.testId}
        />
      );
    default:
      return (
        <DateTimePicker
          date={config.value}
          mode="localDate"
          popupContainer={popupContainer}
          onChange={(iso) => {
            config.onChange(iso);
            onPicked?.();
          }}
          testId={config.testId}
        />
      );
  }
}
