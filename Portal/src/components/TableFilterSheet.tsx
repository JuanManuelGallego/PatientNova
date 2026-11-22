"use client";
import { useId } from "react";
import { ArrowDown, ArrowUp, Check, SlidersHorizontal } from "lucide-react";
import { Sheet } from "./Sheet/Sheet";
import { FilterBody, clearFilter, isFilterActive, type ColumnDef } from "./tableColumns";

export interface TableSortState {
  orderBy?: string;
  order?: "asc" | "desc";
  onSort?: (sortKey: string) => void;
}

const noop = () => {};

function sortableColumns(columns: ColumnDef[], onSort: TableSortState["onSort"]) {
  return onSort ? columns.filter((col) => col.sortKey) : [];
}

function sheetTitle(columns: ColumnDef[], onSort: TableSortState["onSort"]) {
  const hasFilters = columns.some((col) => col.filter);
  const hasSort = sortableColumns(columns, onSort).length > 0;
  if (hasFilters && hasSort) return "Filtros y orden";
  return hasFilters ? "Filtros" : "Ordenar";
}

export function TableCardToolbar({
  columns,
  orderBy,
  order,
  onSort,
  onOpen,
  testId,
}: TableSortState & { columns: ColumnDef[]; onOpen: () => void; testId?: string }) {
  const hasFilters = columns.some((col) => col.filter);
  const sortable = sortableColumns(columns, onSort);
  if (!hasFilters && sortable.length === 0) return null;

  const active = columns.filter((col) => isFilterActive(col.filter)).length;
  const label = hasFilters ? "Filtros" : "Ordenar";
  const sorted = sortable.find((col) => col.sortKey === orderBy);

  return (
    <div className="table-card-toolbar">
      <button
        type="button"
        className={`table-card-toolbar__button${active > 0 ? " table-card-toolbar__button--active" : ""}`}
        aria-label={active > 0 ? `${label}, ${active} ${active === 1 ? "activo" : "activos"}` : label}
        aria-haspopup="dialog"
        onClick={onOpen}
        data-testid={testId ? `${testId}-filters-button` : undefined}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>{label}</span>
        {active > 0 && <span className="table-card-toolbar__count">{active}</span>}
      </button>
      {sorted && (
        <span className="table-card-toolbar__sort">
          {order === "desc" ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />}
          <span className="text-ellipsis">{sorted.label}</span>
          <span className="sr-only">, {order === "desc" ? "descendente" : "ascendente"}</span>
        </span>
      )}
    </div>
  );
}

export function TableFilterSheet({
  columns,
  orderBy,
  order,
  onSort,
  onClose,
  testId,
}: TableSortState & { columns: ColumnDef[]; onClose: () => void; testId?: string }) {
  const baseId = useId();
  const filtered = columns.filter((col) => col.filter);
  const sortable = sortableColumns(columns, onSort);
  const sorted = sortable.find((col) => col.sortKey === orderBy);
  const activeCount = filtered.filter((col) => isFilterActive(col.filter)).length;

  const footer = (
    <>
      {filtered.length > 0 && (
        <button
          type="button"
          className="btn-secondary table-filter-sheet__clear"
          disabled={activeCount === 0}
          onClick={() => filtered.forEach((col) => clearFilter(col.filter!))}
          data-testid={testId ? `${testId}-filters-clear` : undefined}
        >
          Limpiar
        </button>
      )}
      <button
        type="button"
        className="btn-primary"
        onClick={onClose}
        data-testid={testId ? `${testId}-filters-apply` : undefined}
      >
        Ver resultados
      </button>
    </>
  );

  return (
    <Sheet
      title={sheetTitle(columns, onSort)}
      onClose={onClose}
      footer={footer}
      testId={testId ? `${testId}-filters-sheet` : undefined}
    >
      <div className="table-filter-sheet">
        {filtered.map((col, i) => {
          const headingId = `${baseId}-f${i}`;
          return (
            <section key={col.sortKey ?? col.label} className="table-filter-sheet__section" aria-labelledby={headingId}>
              <h3 id={headingId} className="table-filter-sheet__heading">{col.label}</h3>
              <FilterBody config={col.filter!} onClose={noop} />
            </section>
          );
        })}
        {sortable.length > 0 && (
          <section className="table-filter-sheet__section" aria-labelledby={`${baseId}-sort`}>
            <h3 id={`${baseId}-sort`} className="table-filter-sheet__heading">Ordenar por</h3>
            <div role="radiogroup" aria-labelledby={`${baseId}-sort`} className="table-filter-sheet__options">
              {sortable.map((col) => {
                const checked = col.sortKey === orderBy;
                return (
                  <label
                    key={col.sortKey}
                    className={`custom-select__option table-filter-sheet__option${checked ? " custom-select__option--selected" : ""}`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`${baseId}-sort`}
                      value={col.sortKey}
                      checked={checked}
                      onChange={() => onSort!(col.sortKey!)}
                    />
                    <span>{col.label}</span>
                    {checked && (
                      <span className="custom-select__check">
                        <Check size={14} aria-hidden="true" />
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {sorted && (
              <div className="table-filter-sheet__direction" role="group" aria-label="Dirección">
                {(["asc", "desc"] as const).map((dir) => {
                  const pressed = (order ?? "asc") === dir;
                  return (
                    <button
                      key={dir}
                      type="button"
                      aria-pressed={pressed}
                      className={`table-filter-sheet__dir${pressed ? " table-filter-sheet__dir--active" : ""}`}
                      onClick={() => {
                        if (!pressed) onSort!(sorted.sortKey!);
                      }}
                    >
                      {dir === "asc" ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
                      {dir === "asc" ? "Ascendente" : "Descendente"}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}
