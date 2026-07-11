import { addDays, todayFormattedString, DAY_NAMES_ES } from "@/src/utils/TimeUtils";

export { DAY_NAMES_ES };

/** Default hours shown in week/day views (7 AM – 8 PM) */
export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

/** Height in px of a single hour row in the time grid */
export const HOUR_HEIGHT = 48;

/** Minimum chip height in px so very short appointments stay tappable */
export const MIN_CHIP_PX = 20;

export const DEFAULT_FIRST_HOUR = 7;
export const DEFAULT_LAST_HOUR = 20;

export const TODAY_STR = todayFormattedString();

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function apptHour(a: import("@/src/types/Appointment").Appointment): number {
  return new Date(a.startAt).getHours();
}

export function toStartOfDayISO(d: Date): string {
  const local = new Date(d);
  local.setHours(0, 0, 0, 0);
  return local.toISOString();
}

export function toEndOfDayISO(d: Date): string {
  const local = new Date(d);
  local.setHours(23, 59, 59, 999);
  return local.toISOString();
}

export function toUtcRangeFromLocalDay(dateStr: string): {
  dateFrom: string;
  dateTo: string;
} {
  const localStart = new Date(`${dateStr}T00:00:00`);
  localStart.setHours(0, 0, 0, 0);

  const localEnd = new Date(`${dateStr}T00:00:00`);
  localEnd.setHours(23, 59, 59, 999);

  return {
    dateFrom: localStart.toISOString(),
    dateTo: localEnd.toISOString(),
  };
}

export interface HourRange {
  firstHour: number;
  lastHour: number;
  hours: number[];
}

/**
 * Computes the visible hour range for the time grid. When appointments exist,
 * the range is expanded to fit the earliest start and latest end (padded by 1h
 * and clamped to 0–23). Falls back to 7 AM – 8 PM when there are no appointments.
 */
export function computeHourRange(
  appointments: import("@/src/types/Appointment").Appointment[],
): HourRange {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  let found = false;

  for (const a of appointments) {
    const s = new Date(a.startAt);
    const e = new Date(a.endAt);
    const sh = s.getHours();
    const eh = e.getHours() + (e.getMinutes() > 0 ? 1 : 0);
    if (!found) {
      first = sh;
      last = eh;
      found = true;
    } else {
      if (sh < first) first = sh;
      if (eh > last) last = eh;
    }
  }

  if (!found) {
    return {
      firstHour: DEFAULT_FIRST_HOUR,
      lastHour: DEFAULT_LAST_HOUR,
      hours: HOURS,
    };
  }

  first = Math.max(0, first - 1);
  last = Math.min(23, last + 1);
  if (last <= first) last = Math.min(23, first + 1);

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

/**
 * Lays out a day's appointments by their real start/end time so chip height
 * reflects appointment length. Overlapping appointments are placed in side-by-side
 * columns so heights stay accurate without visual overlap.
 */
export function layoutDayAppointments(
  appts: import("@/src/types/Appointment").Appointment[],
  firstHour: number,
): PositionedAppt[] {
  if (appts.length === 0) return [];

  const sorted = [...appts].sort(
    (x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime(),
  );

  const placed: { endMin: number; col: number }[] = [];
  let maxCol = 1;

  const columns = sorted.map((a) => {
    const s = new Date(a.startAt);
    const e = new Date(a.endAt);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();

    let col = 0;
    // Find the first column whose last appointment ends before this one starts.
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

export { addDays };
