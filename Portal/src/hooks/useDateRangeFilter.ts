import { useQueryState, parseAsString } from "nuqs";
import { QUERY_PARAMS } from "@/src/utils/listQuery";
import type { DateRangeValue } from "@/src/components/DateRangePicker";

type DateRangeParam =
  | typeof QUERY_PARAMS.apptDate
  | typeof QUERY_PARAMS.reminderDate
  | typeof QUERY_PARAMS.auditDate;

/**
 * Manages a two-date range stored in a single URL query param as a
 * comma-separated `from,to` pair of local `YYYY-MM-DD` strings. Centralizes
 * the encoding so every list page (appointments, reminders, audit logs) shares
 * one representation and the same serialization rules.
 */
export function useDateRangeFilter(paramKey: DateRangeParam) {
  const [raw, setRaw] = useQueryState(
    paramKey,
    parseAsString.withDefault(""),
  );

  const range: DateRangeValue = raw ? (raw.split(",") as [string, string]) : null;
  const active = !!range && !!range[0] && !!range[1];

  const setRange = (next: DateRangeValue) => {
    setRaw(next && next[0] && next[1] ? `${next[0]},${next[1]}` : "");
  };

  return { range, setRange, active };
}
