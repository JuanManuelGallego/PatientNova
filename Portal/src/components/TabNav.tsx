"use client";
import React from "react";

export interface TabNavItem {
  key: string;
  label: string;
}

export function TabNav({
  items,
  active,
  onSelect,
  testIdPrefix,
  wrapperClassName = "tab-nav",
}: {
  items: TabNavItem[];
  active: string;
  onSelect: (key: string) => void;
  /** When provided, each tab gets `data-testid="${testIdPrefix}-${key.toLowerCase()}"`. */
  testIdPrefix?: string;
  /** Override the wrapper class (defaults to `tab-nav`; use `filter-chips` for segmented controls). */
  wrapperClassName?: string;
}) {
  return (
    <div className={wrapperClassName}>
      {items.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelect(tab.key)}
          className={`filter-chip ${active === tab.key ? " filter-chip--active" : ""}`}
          data-testid={
            testIdPrefix
              ? `${testIdPrefix}-${tab.key.toLowerCase().replace(/\s+/g, "-")}`
              : undefined
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
