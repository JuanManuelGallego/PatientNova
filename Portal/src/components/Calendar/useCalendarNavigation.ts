import { useState, useCallback, useEffect } from "react";
import { useQueryState, parseAsStringEnum, parseAsString } from "nuqs";
import {
  addDays, dateFromStr, getWeekStart, isCalendarDay, toDateStr, toStartOfDayISO, toEndOfDayISO, todayDate,
} from "./constants";
import { ViewMode } from "./types";
import { addCalendarDays } from "@/src/utils/TimeUtils";

interface NavigationOptions {
  phone?: boolean;
}

function effectiveView(requested: ViewMode, phone: boolean): ViewMode {
  if (phone) return requested === ViewMode.Month ? ViewMode.Month : ViewMode.Day;
  return requested === ViewMode.Day ? ViewMode.Week : requested;
}

export function useCalendarNavigation(timezone?: string, { phone = false }: NavigationOptions = {}) {
  const [ requestedView, setViewMode ] = useQueryState<ViewMode>(
    "view",
    parseAsStringEnum<ViewMode>(Object.values(ViewMode)).withDefault(ViewMode.Week),
  );
  const viewMode = effectiveView(requestedView, phone);
  const [ dayParam, setDayParam ] = useQueryState("day", parseAsString);
  const linkedDay = isCalendarDay(dayParam) ? dayParam : null;

  const [ start ] = useState(() => (linkedDay ? dateFromStr(linkedDay) : todayDate(timezone)));
  const [ calYear, setCalYear ] = useState(() => start.getFullYear());
  const [ calMonth, setCalMonth ] = useState(() => start.getMonth());
  const [ pagedWeekStart, setWeekStart ] = useState<Date>(() => getWeekStart(start));
  const [ selectedDay, setSelectedDay ] = useState<string | null>(null);
  const dayDate = linkedDay ?? toDateStr(todayDate(timezone));

  const [ followedDay, setFollowedDay ] = useState(dayDate);
  if (followedDay !== dayDate) {
    const date = dateFromStr(dayDate);
    setFollowedDay(dayDate);
    setWeekStart(getWeekStart(date));
    setCalYear(date.getFullYear());
    setCalMonth(date.getMonth());
  }
  const weekStart = viewMode === ViewMode.Day ? getWeekStart(dateFromStr(dayDate)) : pagedWeekStart;

  const calendarFilters = (() => {
    if (viewMode === ViewMode.Month) {
      return {
        dateFrom: toStartOfDayISO(new Date(calYear, calMonth, 1), timezone),
        dateTo: toEndOfDayISO(new Date(calYear, calMonth + 1, 0), timezone),
      };
    }
    return {
      dateFrom: toStartOfDayISO(weekStart, timezone),
      dateTo: toEndOfDayISO(addDays(weekStart, 6), timezone),
    };
  })();

  const focusDay = useCallback((day: string) => {
    const date = dateFromStr(day);
    void setDayParam(day === toDateStr(todayDate(timezone)) ? null : day);
    setWeekStart(getWeekStart(date));
    setCalYear(date.getFullYear());
    setCalMonth(date.getMonth());
  }, [ setDayParam, timezone ]);

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
    const now = todayDate(timezone);
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setWeekStart(getWeekStart(now));
    void setDayParam(null);
  }, [ timezone, setDayParam ]);

  const navPrev = useCallback(() => {
    if (viewMode === ViewMode.Month) prevMonth();
    else if (viewMode === ViewMode.Day) focusDay(addCalendarDays(dayDate, -7));
    else prevWeek();
  }, [ viewMode, prevMonth, prevWeek, focusDay, dayDate ]);

  const navNext = useCallback(() => {
    if (viewMode === ViewMode.Month) nextMonth();
    else if (viewMode === ViewMode.Day) focusDay(addCalendarDays(dayDate, 7));
    else nextWeek();
  }, [ viewMode, nextMonth, nextWeek, focusDay, dayDate ]);

  const selectDay = useCallback((day: string) => {
    focusDay(day);
    void setViewMode(ViewMode.Day);
  }, [ focusDay, setViewMode ]);

  const drillToDay = useCallback(
    (dateStr: string) => {
      focusDay(dateStr);
      void setViewMode(phone ? ViewMode.Day : ViewMode.Week);
    },
    [ phone, focusDay, setViewMode ],
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
    selectDay,
    calendarFilters,
    navPrev,
    navNext,
    goToday,
    drillToDay,
  };
}
