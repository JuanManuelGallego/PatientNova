import React from "react";
import { SkeletonRow } from "./Info/Skeleton";
import { PAGINATION_ICONS } from "@/src/config/icons";

interface TableFooterProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  label: string;
  onPageChange: (page: number) => void;
}

export function TableFooter({
  page,
  pageSize,
  total,
  totalPages,
  label,
  onPageChange,
}: TableFooterProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | "...")[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(n);
      return acc;
    }, []);

  return (
    <>
      <span style={{ fontSize: 13, color: "var(--c-gray-400)" }}>
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
            >
              {item}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="pagination-btn"
        >
          Siguiente <PAGINATION_ICONS.next size={14} />
        </button>
      </div>
    </>
  );
}

interface DataTableProps<T> {
  /** Header label strings — also drives colSpan for the empty state row. */
  columns: string[];
  rows: T[];
  loading: boolean;
  skeletonCount?: number;
  /** Must return a `<tr key={...}>` element. */
  renderRow: (item: T, index: number) => React.ReactNode;
  /** Rendered inside `<tr><td colSpan={columns.length}>` when rows is empty and not loading. */
  emptyState?: React.ReactNode;
  /** Rendered inside the footer bar (flex row, space-between). Hidden when rows is empty. */
  footer?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  skeletonCount = 5,
  renderRow,
  emptyState,
  footer,
}: DataTableProps<T>) {
  return (
    <div className="table-card">
      {/* responsive: horizontal scroll wrapper for narrow viewports */}
      <div className="table-scroll">
        <table className="table-full">
          <thead>
            <tr>
              {columns.map((h) => (
                <th key={h} className="th">
                  {h}
                </th>
              ))}
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
    </div>
  );
}
