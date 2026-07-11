import { useState, useCallback, useEffect } from "react";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { addDays, getWeekStart, toDateStr, toStartOfDayISO, toEndOfDayISO, toUtcRangeFromLocalDay } from "./constants";
import { ViewMode } from "./types";

export function useCalendarNavigation() {
  const [ viewMode, setViewMode ] = useQueryState<ViewMode>(
    "view",
    parseAsStringEnum<ViewMode>(Object.values(ViewMode)).withDefault(ViewMode.Week),
  );
  const [ calYear, setCalYear ] = useState(new Date().getFullYear());
  const [ calMonth, setCalMonth ] = useState(new Date().getMonth());
  const [ weekStart, setWeekStart ] = useState<Date>(() => getWeekStart(new Date()));
  const [ dayDate, setDayDate ] = useState<string>(toDateStr(new Date()));
  const [ selectedDay, setSelectedDay ] = useState<string | null>(null);

  const calendarFilters = (() => {
    if (viewMode === ViewMode.Month) {
      return {
        dateFrom: toStartOfDayISO(new Date(calYear, calMonth, 1)),
        dateTo: toEndOfDayISO(new Date(calYear, calMonth + 1, 0)),
      };
    }
    if (viewMode === ViewMode.Week) {
      return {
        dateFrom: toStartOfDayISO(weekStart),
        dateTo: toEndOfDayISO(addDays(weekStart, 6)),
      };
    }
    return toUtcRangeFromLocalDay(dayDate);
  })();

  const prevMonth = useCallback(() => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  }, [ calMonth ]);

  const nextMonth = useCallback(() => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  }, [ calMonth ]);

  const prevWeek = useCallback(() => setWeekStart((d) => addDays(d, -7)), []);
  const nextWeek = useCallback(() => setWeekStart((d) => addDays(d, 7)), []);

  const prevDay = useCallback(
    () => setDayDate((s) => toDateStr(addDays(new Date(s), -1))),
    [],
  );
  const nextDay = useCallback(
    () => setDayDate((s) => toDateStr(addDays(new Date(s), 1))),
    [],
  );

  const goToday = useCallback(() => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setWeekStart(getWeekStart(now));
    setDayDate(toDateStr(now));
  }, []);

  const navPrev = useCallback(() => {
    if (viewMode === ViewMode.Month) prevMonth();
    else if (viewMode === ViewMode.Week) prevWeek();
    else prevDay();
  }, [ viewMode, prevMonth, prevWeek, prevDay ]);

  const navNext = useCallback(() => {
    if (viewMode === ViewMode.Month) nextMonth();
    else if (viewMode === ViewMode.Week) nextWeek();
    else nextDay();
  }, [ viewMode, nextMonth, nextWeek, nextDay ]);

  const drillToDay = useCallback(
    (dateStr: string) => {
      setDayDate(dateStr);
      setViewMode(ViewMode.Day);
    },
    [ setViewMode ],
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowLeft") navPrev();
      if (e.key === "ArrowRight") navNext();
      if (e.key === "m" || e.key === "M") setViewMode(ViewMode.Month);
      if (e.key === "w" || e.key === "W") setViewMode(ViewMode.Week);
      if (e.key === "d" || e.key === "D") setViewMode(ViewMode.Day);
      if (e.key === "t" || e.key === "T") goToday();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ navPrev, navNext, goToday, setViewMode ]);

  return {
    viewMode,
    setViewMode,
    calYear,
    calMonth,
    weekStart,
    dayDate,
    selectedDay,
    setSelectedDay,
    calendarFilters,
    navPrev,
    navNext,
    goToday,
    drillToDay,
  };
}
