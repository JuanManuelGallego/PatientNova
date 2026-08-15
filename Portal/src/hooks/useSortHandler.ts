import { useCallback } from "react";
import { SORT_DIRECTION, type SortDirection } from "@/src/utils/listQuery";

/**
 * Returns a stable `onSort` handler that toggles direction on the active
 * column and resets to ascending when a new column is chosen.
 *
 * `sortable` is the set of column `sortKey`s that are actually sortable in the
 * UI; anything else passed to the handler is ignored.
 */
export function useSortHandler<T extends string>(
  sortable: readonly T[],
  orderBy: T,
  setOrderBy: (value: T) => void,
  order: SortDirection,
  setOrder: (value: SortDirection) => void,
  setPage: (page: number) => void,
): (sortKey: string) => void {
  return useCallback(
    (sortKey: string) => {
      if (!(sortable as readonly string[]).includes(sortKey)) return;
      if (orderBy === sortKey) {
        setOrder(order === SORT_DIRECTION.asc ? SORT_DIRECTION.desc : SORT_DIRECTION.asc);
      } else {
        setOrderBy(sortKey as T);
        setOrder(SORT_DIRECTION.asc);
      }
      setPage(1);
    },
    [sortable, orderBy, setOrderBy, order, setOrder, setPage],
  );
}
