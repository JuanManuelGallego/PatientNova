import { addDays, todayFormattedString, DAY_NAMES_ES } from "@/src/utils/TimeUtils";

export { DAY_NAMES_ES };

/** Hours shown in week/day views (7 AM – 8 PM) */
export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

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
  const localStart = new Date(dateStr);
  localStart.setHours(0, 0, 0, 0);
  localStart.setDate(localStart.getDate() + 1);

  const localEnd = new Date(dateStr);
  localEnd.setHours(23, 59, 59, 999);
  localEnd.setDate(localEnd.getDate() + 1);

  return {
    dateFrom: localStart.toISOString(),
    dateTo: localEnd.toISOString(),
  };
}

export { addDays };
