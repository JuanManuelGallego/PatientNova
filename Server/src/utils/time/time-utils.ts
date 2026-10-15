import { DateTime, IANAZone } from 'luxon';

/**
 * Timezone helpers backed by luxon (IANA tzdata), correct across DST transitions.
 *
 * Conventions for local wall-clock times that DST makes odd:
 *  - Spring-forward gap (the local time does not exist): `localToUtc` moves it forward by the
 *    size of the gap; `resolveLocalTime` reports `exists: false` so callers (slot generation)
 *    can skip it instead.
 *  - Fall-back overlap (the local time happens twice): the FIRST occurrence (earlier instant,
 *    still on daylight time) is used.
 *
 * An invalid timezone throws a RangeError from every helper (never a silent UTC fallback):
 * timezones are validated on input, so a bad one is a data bug that must surface, not
 * produce plausible-but-wrong times.
 */

export function isValidIANATimezone(tz: string): boolean {
  return IANAZone.isValidZone(tz);
}

function assertZone(timezone: string): string {
  if (!isValidIANATimezone(timezone)) throw new RangeError(`Invalid time zone specified: ${timezone}`);
  return timezone;
}

function localNow(timezone: string, now: Date): DateTime {
  return DateTime.fromJSDate(now, { zone: assertZone(timezone) });
}

export function getLocalTimeParts(
  timezone: string,
  date: Date = new Date(),
): { year: number; month: number; day: number; hour: number; minute: number } {
  const dt = localNow(timezone, date);
  return { year: dt.year, month: dt.month, day: dt.day, hour: dt.hour, minute: dt.minute };
}

export interface ResolvedLocalTime {
  /** The instant this wall-clock time maps to (shifted forward when the time does not exist). */
  utc: Date;
  /** False when the wall-clock time falls in a spring-forward gap. */
  exists: boolean;
  /** True when the wall-clock time occurs twice (fall-back); `utc` is the first occurrence. */
  ambiguous: boolean;
}

/** Resolves a local calendar date+time in an IANA timezone, reporting DST gaps and overlaps. */
export function resolveLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): ResolvedLocalTime {
  // luxon shifts gap times forward; a gap shows up as wall-clock fields that do not round-trip.
  const dt = DateTime.fromObject({ year, month, day, hour, minute, second }, { zone: assertZone(timezone) });
  const exists = dt.year === year && dt.month === month && dt.day === day
    && dt.hour === hour && dt.minute === minute && dt.second === second;
  const occurrences = exists ? dt.getPossibleOffsets() : [ dt ];
  const first = occurrences.reduce((a, b) => (b.toMillis() < a.toMillis() ? b : a));
  return { utc: first.toJSDate(), exists, ambiguous: occurrences.length > 1 };
}

/** Converts a local calendar date+time in a given IANA timezone to a UTC Date (see conventions above). */
export function localToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timezone: string): Date {
  return resolveLocalTime(year, month, day, hour, minute, second, timezone).utc;
}

/** UTC bounds of the local calendar day containing `date` (start 00:00:00.000, end 23:59:59.999). */
export function getDayBoundsInTz(timezone: string, date: Date): { start: Date; end: Date } {
  const local = localNow(timezone, date);
  return { start: local.startOf('day').toJSDate(), end: local.endOf('day').toJSDate() };
}

/** Returns the UTC start (00:00:00.000) and end (23:59:59.999) of today in the given IANA timezone. */
export function getTodayBoundsInTz(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  return getDayBoundsInTz(timezone, now);
}

/** UTC bounds of tomorrow (local calendar day) in the given IANA timezone, end inclusive at .999. */
export function getTomorrowUTCRange(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  const tomorrow = localNow(timezone, now).plus({ days: 1 });
  return { start: tomorrow.startOf('day').toJSDate(), end: tomorrow.endOf('day').toJSDate() };
}

/** Local calendar date (YYYY-MM-DD) in the given timezone, optionally offset by whole days. */
export function getLocalDateString(timezone: string, now: Date = new Date(), plusDays = 0): string {
  return localNow(timezone, now).plus({ days: plusDays }).toISODate()!;
}

export function getCurrentMonthBoundsInTz(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  const local = localNow(timezone, now);
  return { start: local.startOf('month').toJSDate(), end: local.endOf('month').toJSDate() };
}
