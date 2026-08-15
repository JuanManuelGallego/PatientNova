import { useQueryState, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs";
import { useDebounceState } from "./useDebounceState";
import { useSortHandler } from "./useSortHandler";
import { QUERY_PARAMS, SORT_DIRECTION, type SortDirection } from "@/src/utils/listQuery";

export interface UseListQueryStateArgs<T extends string> {
  orderByOptions: readonly T[];
  orderByDefault: T;
  sortable: readonly T[];
  /** Default sort direction. Defaults to ascending (audit log uses "desc"). */
  orderDefault?: SortDirection;
}

/**
 * Centralizes the list-page URL query state shared by every data table:
 * `page`, `search` (+ debounced), `orderBy`, `order`, and the `handleSort`
 * callback. Returns a `searchProps` object ready to spread into `<FilterBar>`.
 *
 * Resource-specific state (status, date filters, tabs, etc.) stays in the page.
 */
export function useListQueryState<T extends string>({
  orderByOptions,
  orderByDefault,
  sortable,
  orderDefault = SORT_DIRECTION.asc,
}: UseListQueryStateArgs<T>) {
  const [page, setPage] = useQueryState(
    QUERY_PARAMS.page,
    parseAsInteger.withDefault(1),
  );
  const [search, setSearch] = useQueryState(
    QUERY_PARAMS.search,
    parseAsString.withDefault(""),
  );
  const debouncedSearch = useDebounceState(search, 250);
  const [orderBy, setOrderBy] = useQueryState(
    QUERY_PARAMS.orderBy,
    parseAsStringEnum([...orderByOptions]).withDefault(orderByDefault),
  );
  const [order, setOrder] = useQueryState(
    QUERY_PARAMS.order,
    parseAsStringEnum([SORT_DIRECTION.asc, SORT_DIRECTION.desc]).withDefault(orderDefault),
  );

  const handleSort = useSortHandler<T>(
    sortable,
    orderBy,
    setOrderBy,
    order,
    setOrder,
    setPage,
  );

  const searchProps = {
    value: search,
    onChange: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    onClear: () => {
      setSearch("");
      setPage(1);
    },
  };

  return {
    page,
    setPage,
    search,
    setSearch,
    debouncedSearch,
    orderBy,
    setOrderBy,
    order,
    setOrder,
    handleSort,
    searchProps,
  };
}
