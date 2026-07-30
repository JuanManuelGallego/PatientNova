import { useState, useCallback, useEffect } from "react";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { addDays, getWeekStart, toDateStr, toStartOfDayISO, toEndOfDayISO } from "./constants";
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
      return {
        dateFrom: toStartOfDayISO(weekStart),
        dateTo: toEndOfDayISO(addDays(weekStart, 6)),
      };
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


  const goToday = useCallback(() => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setWeekStart(getWeekStart(now));
    setDayDate(toDateStr(now));
  }, []);

  const navPrev = useCallback(() => {
    if (viewMode === ViewMode.Month) prevMonth();
    else prevWeek();
  }, [viewMode, prevMonth, prevWeek]);

  const navNext = useCallback(() => {
    if (viewMode === ViewMode.Month) nextMonth();
    else nextWeek();
  }, [ viewMode, nextMonth, nextWeek ]);

  const drillToDay = useCallback(
    (dateStr: string) => {
      setDayDate(dateStr);
    },
    [],
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
