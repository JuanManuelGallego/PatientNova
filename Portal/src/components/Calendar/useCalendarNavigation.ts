import { useState, useCallback, useEffect } from "react";
import { useQueryState, parseAsStringEnum, parseAsString } from "nuqs";
import {
  addDays, dateFromStr, getWeekStart, isCalendarDay, toDateStr, toStartOfDayISO, toEndOfDayISO, todayDate,
} from "./constants";
import { ViewMode } from "./types";
import { addCalendarDays } from "@/src/utils/TimeUtils";

interface NavigationOptions {
  /** Phone layout: the agenda (Day) replaces Week, and Month becomes a day picker. */
  phone?: boolean;
}

/** The view a screen shows for the `view` query value: phones have Day and Month, wider screens Month and Week. */
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
  // The agenda's day, kept in the link like the view (replace history: moving through days adds no Back steps).
  const [ dayParam, setDayParam ] = useQueryState("day", parseAsString);
  const linkedDay = isCalendarDay(dayParam) ? dayParam : null;

  // Navigation state opens on the linked day (a phone's agenda link) or on today in the provider's timezone.
  const [ start ] = useState(() => (linkedDay ? dateFromStr(linkedDay) : todayDate(timezone)));
  const [ calYear, setCalYear ] = useState(() => start.getFullYear());
  const [ calMonth, setCalMonth ] = useState(() => start.getMonth());
  const [ pagedWeekStart, setWeekStart ] = useState<Date>(() => getWeekStart(start));
  const [ selectedDay, setSelectedDay ] = useState<string | null>(null);
  const dayDate = linkedDay ?? toDateStr(todayDate(timezone));

  // Whatever moves the day (the strip, a link that drops ?day, Back, a pasted link) moves the week and the
  // month with it, so a wider screen shows that day's week next. Adjusted during render, not in an effect,
  // so no frame shows the old week.
  const [ followedDay, setFollowedDay ] = useState(dayDate);
  if (followedDay !== dayDate) {
    const date = dateFromStr(dayDate);
    setFollowedDay(dayDate);
    setWeekStart(getWeekStart(date));
    setCalYear(date.getFullYear());
    setCalMonth(date.getMonth());
  }
  // The agenda always shows (and fetches) the week of its day; Week keeps the week it was paged to.
  const weekStart = viewMode === ViewMode.Day ? getWeekStart(dateFromStr(dayDate)) : pagedWeekStart;

  const calendarFilters = (() => {
    if (viewMode === ViewMode.Month) {
      return {
        dateFrom: toStartOfDayISO(new Date(calYear, calMonth, 1), timezone),
        dateTo: toEndOfDayISO(new Date(calYear, calMonth + 1, 0), timezone),
      };
    }
    // Week and the agenda (whose strip needs the whole week) fetch Monday to Sunday.
    return {
      dateFrom: toStartOfDayISO(weekStart, timezone),
      dateTo: toEndOfDayISO(addDays(weekStart, 6), timezone),
    };
  })();

  /** Points the agenda, the week and the month at `day` (they follow the day, see above). */
  const focusDay = useCallback((day: string) => {
    const date = dateFromStr(day);
    void setDayParam(day === toDateStr(todayDate(timezone)) ? null : day);
    // Also set here: re-selecting the current day must still bring a paged week or month back to it.
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

  /** Phones: shows `day` in the agenda (from the week strip or the month day picker). */
  const selectDay = useCallback((day: string) => {
    focusDay(day);
    void setViewMode(ViewMode.Day);
  }, [ focusDay, setViewMode ]);

  /** "Ver día": the agenda on a phone, the week of that day on a wider screen. */
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
