import { useMemo } from "react";
import {
  MONTH_NAMES_ES,
  fmtDate,
  getColombianHolidays,
  addDays,
} from "@/src/utils/timeUtils";
import { Appointment } from "@/src/types/Appointment";
import { ViewMode } from "./types";
import { computeHourRange, toDateStr } from "./constants";

interface UseCalendarDataArgs {
  calYear: number;
  calMonth: number;
  weekStart: Date;
  dayDate: string;
  viewMode: ViewMode;
  appointments: Appointment[];
}

export function useCalendarData({
  calYear,
  calMonth,
  weekStart,
  dayDate,
  viewMode,
  appointments,
}: UseCalendarDataArgs) {
  const { daysInMonth, startOffset, rows } = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const rows = Math.ceil((startOffset + daysInMonth) / 7);
    return { daysInMonth, startOffset, rows };
  }, [ calYear, calMonth ]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [ weekStart ],
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sm = MONTH_NAMES_ES[ weekStart.getMonth() ];
    const em = MONTH_NAMES_ES[ end.getMonth() ];
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()} – ${end.getDate()} ${sm} ${weekStart.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${sm} – ${end.getDate()} ${em} ${end.getFullYear()}`;
  }, [ weekStart ]);

  const apptByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      const local = new Date(a.startAt);
      const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
      if (!map[ date ]) map[ date ] = [];
      map[ date ].push(a);
    }
    return map;
  }, [ appointments ]);

  const holidayMap = useMemo(() => {
    const holidays = getColombianHolidays(calYear);
    const map: Record<string, string> = {};
    for (const h of holidays) map[ h.date ] = h.name;
    return map;
  }, [ calYear ]);

  const cellDate = (cell: number): string | null => {
    const day = cell - startOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const navLabel =
    viewMode === ViewMode.Month
      ? `${MONTH_NAMES_ES[ calMonth ]} ${calYear}`
      : viewMode === ViewMode.Week
        ? weekLabel
        : fmtDate(dayDate);

  const hourRange = useMemo(() => {
    if (viewMode === ViewMode.Week) {
      const weekAppts = weekDays.flatMap((d) => apptByDate[ toDateStr(d) ] ?? []);
      return computeHourRange(weekAppts);
    }
    if (viewMode === ViewMode.Day) {
      return computeHourRange(apptByDate[ dayDate ] ?? []);
    }
    return computeHourRange([]);
  }, [ viewMode, weekDays, apptByDate, dayDate ]);

  return {
    daysInMonth,
    startOffset,
    rows,
    weekDays,
    weekLabel,
    apptByDate,
    holidayMap,
    cellDate,
    navLabel,
    hourRange,
  };
}
