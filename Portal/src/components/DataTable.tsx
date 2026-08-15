"use client";
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { SkeletonRow } from "./Info/Skeleton";
import { PAGINATION_ICONS, ACTION_ICONS } from "@/src/config/icons";
import { SelectOption } from "./CustomSelect";
import { DateTimePicker } from "./DateTimePicker";
import { EnumFilter } from "./EnumFilter";
import { ChevronUp, ChevronDown } from "lucide-react";

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
    };

export interface ColumnDef {
  label: string;
  sortKey?: string;
  filter?: ColumnFilterConfig;
}

interface TableFooterProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  label: string;
  onPageChange: (page: number) => void;
  /** Optional prefix that scopes the pagination control test IDs (e.g. "appointments-pagination"). */
  testIdPrefix?: string;
}

export function TableFooter({
  page,
  pageSize,
  total,
  totalPages,
  label,
  onPageChange,
  testIdPrefix,
}: TableFooterProps) {
  const prevTestId = testIdPrefix ? `${testIdPrefix}-previous` : undefined;
  const nextTestId = testIdPrefix ? `${testIdPrefix}-next` : undefined;
  const countTestId = testIdPrefix ? `${testIdPrefix}-count` : undefined;
  const pageTestId = (n: number) =>
    testIdPrefix ? `${testIdPrefix}-page-${n}` : undefined;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | "...")[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(n);
      return acc;
    }, []);

  return (
    <>
      <span style={{ fontSize: 13, color: "var(--c-gray-400)" }} data-testid={countTestId}>
        Mostrando{" "}
        <strong style={{ color: "var(--c-gray-700)" }}>
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
        </strong>{" "}
        de <strong style={{ color: "var(--c-gray-700)" }}>{total}</strong>{" "}
        {label}
      </span>
      <div className="pagination">
        {
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="pagination-btn"
            data-testid={prevTestId}
          >
            <PAGINATION_ICONS.prev size={14} /> Anterior
          </button>
        }
        {pages.map((item, idx) =>
          item === "..." ? (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item as number)}
              className={`pagination-num ${page === item ? "pagination-num--active" : ""}`}
              data-testid={pageTestId(item as number)}
            >
              {item}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="pagination-btn"
          data-testid={nextTestId}
        >
          Siguiente <PAGINATION_ICONS.next size={14} />
        </button>
      </div>
    </>
  );
}

interface DataTableProps<T> {
  /** Column definitions — also drives colSpan for the empty state row. */
  columns: ColumnDef[];
  rows: T[];
  loading: boolean;
  skeletonCount?: number;
  /** Must return a `<tr key={...}>` element. */
  renderRow: (item: T, index: number) => React.ReactNode;
  /** Rendered inside `<tr><td colSpan={columns.length}>` when rows is empty and not loading. */
  emptyState?: React.ReactNode;
  /** Rendered inside the footer bar (flex row, space-between). Hidden when rows is empty. */
  footer?: React.ReactNode;
  testId?: string;
  /** Active sort key, used to render sort indicators. */
  orderBy?: string;
  /** Active sort direction. */
  order?: "asc" | "desc";
  /** Called when a sortable header is activated. */
  onSort?: (sortKey: string) => void;
}

function HeaderFilterPopover({
  config,
  getAnchor,
  onClose,
}: {
  config: ColumnFilterConfig;
  getAnchor: () => HTMLElement | null;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const update = useCallback(() => {
    const el = popoverRef.current;
    const anchor = getAnchor();
    if (!el || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popW = el.offsetWidth;
    const popH = el.offsetHeight;
    const margin = 8;
    let top = rect.bottom + 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popH + margin) {
      top = Math.max(margin, rect.top - popH - 4);
    }
    let left = rect.left;
    if (left + popW > window.innerWidth - margin) {
      left = window.innerWidth - popW - margin;
    }
    if (left < margin) left = margin;
    setPos({ top, left });
  }, [getAnchor]);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    const handler = () => update();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [update]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const el = popoverRef.current;
      const anchor = getAnchor();
      if (el?.contains(target)) return;
      if (anchor?.contains(target)) return;
      if (target instanceof Element) {
        if (target.closest(".custom-select__dropdown")) return;
        if (target.closest(".ant-picker-dropdown")) return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [getAnchor, onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      className="th-filter-popover"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label="Filtro"
    >
      {config.kind === "enum" ? (
        <EnumFilter
          options={config.options}
          value={config.value}
          onChange={config.onChange}
          testId={config.testId}
        />
      ) : (
        <>
          <DateTimePicker
            date={config.value}
            onChanged={(iso) => {
              config.onChange(iso);
              onClose();
            }}
            testId={config.testId}
          />
          {config.value !== "" && (
            <button
              type="button"
              className="btn-secondary btn-secondary--sm th-filter-popover__clear"
              onClick={() => {
                config.onChange("");
                onClose();
              }}
            >
              <ACTION_ICONS.close size={12} /> Limpiar
            </button>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  skeletonCount = 5,
  renderRow,
  emptyState,
  footer,
  testId,
  orderBy,
  order,
  onSort,
}: DataTableProps<T>) {
  const [openColumnIndex, setOpenColumnIndex] = useState<number | null>(null);
  const headerRefs = useRef<Array<HTMLElement | null>>([]);

  const closePopover = useCallback(() => setOpenColumnIndex(null), []);

  return (
    <div className="table-card">
      {/* responsive: horizontal scroll wrapper for narrow viewports */}
      <div className="table-scroll">
        <table className="table-full" data-testid={testId}>
          <thead>
            <tr>
              {columns.map((col, i) => {
                const sortable = Boolean(col.sortKey && onSort);
                const isSorted =
                  sortable && orderBy === col.sortKey;
                const ariaSort = sortable
                  ? isSorted
                    ? order === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined;
                const filter = col.filter;
                const filterActive = filter
                  ? filter.kind === "enum"
                    ? filter.value.length > 0
                    : filter.value !== ""
                  : false;
                return (
                  <th
                    key={i}
                    className="th"
                    aria-sort={ariaSort}
                    ref={(el) => {
                      headerRefs.current[i] = el;
                    }}
                  >
                    <div className="th-content">
                      {sortable ? (
                        <button
                          type="button"
                          className="th-sort-btn"
                          onClick={() => onSort!(col.sortKey!)}
                          aria-label={`Ordenar por ${col.label}`}
                        >
                          <span>{col.label}</span>
                          {isSorted &&
                            (order === "asc" ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </button>
                      ) : (
                        <span className="th-label">{col.label}</span>
                      )}
                      {filter && (
                        <button
                          type="button"
                          className={`th-filter-btn${filterActive ? " th-filter-btn--active" : ""}`}
                          aria-expanded={openColumnIndex === i}
                          aria-label={`Filtrar por ${col.label}`}
                          data-testid={filter.triggerTestId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColumnIndex(
                              openColumnIndex === i ? null : i,
                            );
                          }}
                        >
                          <ACTION_ICONS.filter size={14} />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            {!loading && rows.map((row, i) => renderRow(row, i))}
            {!loading && rows.length === 0 && emptyState && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: 56, textAlign: "center" }}
                >
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > 0 && footer && (
        <div className="table-footer">{footer}</div>
      )}
      {openColumnIndex !== null &&
        typeof document !== "undefined" &&
        columns[openColumnIndex]?.filter &&
        createPortal(
          <HeaderFilterPopover
            config={columns[openColumnIndex].filter!}
            getAnchor={() => headerRefs.current[openColumnIndex]}
            onClose={closePopover}
          />,
          document.body,
        )}
    </div>
  );
}
