import { addDays, todayFormattedString, localDateTimeToUtc, zonedDateTimeParts, getDisplayTimezone, nextCalendarDay, DAY_NAMES_ES } from "@/src/utils/TimeUtils";
import { BlockedTime } from "@/src/types/BlockedTime";

export { DAY_NAMES_ES };

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export const HOUR_HEIGHT = 48;

export const MIN_CHIP_PX = 20;

export const DEFAULT_FIRST_HOUR = 7;
export const DEFAULT_LAST_HOUR = 20;

/** Today in the provider's timezone, as a local-midnight Date for calendar navigation. */
export function todayDate(timezone?: string): Date {
  const [ y, m, d ] = todayFormattedString(timezone).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Minutes since midnight of an instant on calendar day `day` (provider's timezone), clamped to that day:
 * an instant on an earlier day is 0 and one on a later day is 24:00, so an event that crosses midnight is
 * drawn up to the end of its first day and from the start of the next.
 */
function minuteOfDay(iso: string, timezone: string | undefined, day: string): number {
  const { dateStr, hour, minute } = zonedDateTimeParts(iso, timezone);
  if (dateStr < day) return 0;
  if (dateStr > day) return MINUTES_PER_DAY;
  return hour * 60 + minute;
}

/** Calendar days (YYYY-MM-DD, provider's timezone) an event covers; an end exactly at midnight is exclusive. */
export function eventDays(startIso: string, endIso: string, timezone?: string): string[] {
  const first = zonedDateTimeParts(startIso, timezone).dateStr;
  const end = zonedDateTimeParts(endIso, timezone);
  const endsAtMidnight = end.hour === 0 && end.minute === 0 && end.second === 0;
  const days = [ first ];
  for (let day = nextCalendarDay(first); day < end.dateStr || (day === end.dateStr && !endsAtMidnight); day = nextCalendarDay(day)) {
    days.push(day);
  }
  return days;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function apptHour(a: import("@/src/types/Appointment").Appointment, timezone?: string): number {
  return zonedDateTimeParts(a.startAt, timezone).hour;
}

export function toStartOfDayISO(d: Date, timezone?: string): string {
  return toUtcRangeFromLocalDay(toDateStr(d), timezone).dateFrom;
}

export function toEndOfDayISO(d: Date, timezone?: string): string {
  return toUtcRangeFromLocalDay(toDateStr(d), timezone).dateTo;
}

export function toUtcRangeFromLocalDay(
  dateStr: string,
  timezone = getDisplayTimezone(),
): {
  dateFrom: string;
  dateTo: string;
} {
  return {
    dateFrom: localDateTimeToUtc(dateStr, "00:00:00.000", timezone),
    dateTo: localDateTimeToUtc(dateStr, "23:59:59.999", timezone),
  };
}

export interface HourRange {
  firstHour: number;
  lastHour: number;
  hours: number[];
}

export function computeHourRange(
  appointments: import("@/src/types/Appointment").Appointment[],
  blockedTimes: BlockedTime[] = [],
  timezone?: string,
): HourRange {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;

  const ranges = [
    ...appointments.map((a) => [a.startAt, a.endAt]),
    ...blockedTimes.map((bt) => [bt.startTimeUtc, bt.endTimeUtc]),
  ];
  for (const [start, end] of ranges) {
    for (const day of eventDays(start, end, timezone)) {
      const sh = Math.floor(minuteOfDay(start, timezone, day) / 60);
      const eh = Math.ceil(minuteOfDay(end, timezone, day) / 60);
      if (sh < first) first = Math.max(0, sh - 1);
      if (eh > last) last = Math.min(23, eh + 1);
    }
  }

  return {
    firstHour: first,
    lastHour: last,
    hours: Array.from({ length: last - first + 1 }, (_, i) => first + i),
  };
}

export interface PositionedAppt {
  a: import("@/src/types/Appointment").Appointment;
  top: number;
  height: number;
  left: number;
  width: number;
}

export function layoutDayAppointments(
  appts: import("@/src/types/Appointment").Appointment[],
  firstHour: number,
  timezone?: string,
  /** The calendar day being drawn; defaults to each appointment's start day. */
  day?: string,
): PositionedAppt[] {
  if (appts.length === 0) return [];

  const sorted = [...appts].sort(
    (x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime(),
  );

  const placed: { endMin: number; col: number }[] = [];
  let maxCol = 1;

  const columns = sorted.map((a) => {
    const d = day ?? zonedDateTimeParts(a.startAt, timezone).dateStr;
    const startMin = minuteOfDay(a.startAt, timezone, d);
    const endMin = minuteOfDay(a.endAt, timezone, d);

    let col = 0;

    for (;;) {
      const occupant = placed.find((p) => p.col === col && p.endMin > startMin);
      if (!occupant) break;
      col++;
    }
    placed.push({ endMin, col });
    if (col + 1 > maxCol) maxCol = col + 1;
    return { a, startMin, endMin, col };
  });

  return columns.map(({ a, startMin, endMin, col }) => ({
    a,
    top: ((startMin - firstHour * 60) / 60) * HOUR_HEIGHT,
    height: Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, MIN_CHIP_PX),
    left: (col * 100) / maxCol,
    width: 100 / maxCol,
  }));
}

export interface PositionedBlockedTime {
  bt: BlockedTime;
  top: number;
  height: number;
}

export function layoutBlockedTimes(
  blockedTimes: BlockedTime[],
  firstHour: number,
  timezone?: string,
  /** The calendar day being drawn; defaults to each block's start day. */
  day?: string,
): PositionedBlockedTime[] {
  return blockedTimes.map((bt) => {
    const d = day ?? zonedDateTimeParts(bt.startTimeUtc, timezone).dateStr;
    const startMin = minuteOfDay(bt.startTimeUtc, timezone, d);
    const endMin = minuteOfDay(bt.endTimeUtc, timezone, d);
    return {
      bt,
      top: ((startMin - firstHour * 60) / 60) * HOUR_HEIGHT,
      height: Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, MIN_CHIP_PX),
    };
  });
}

export { addDays };
