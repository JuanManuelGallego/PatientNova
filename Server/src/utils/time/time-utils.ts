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
 */

export function isValidIANATimezone(tz: string): boolean {
  return IANAZone.isValidZone(tz);
}

function safeZone(timezone: string): string {
  return isValidIANATimezone(timezone) ? timezone : 'UTC';
}

export function getLocalTimeParts(
  timezone: string,
  date: Date = new Date(),
): { year: number; month: number; day: number; hour: number; minute: number } {
  const dt = DateTime.fromJSDate(date, { zone: safeZone(timezone) });
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
  if (!isValidIANATimezone(timezone)) throw new RangeError(`Invalid time zone specified: ${timezone}`);
  const zone = IANAZone.create(timezone);

  // The wall-clock time read as if it were UTC; an instant maps to it iff (instant + offset(instant)) equals it.
  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetsMin = new Set([
    zone.offset(asUtcMs - 36 * 3_600_000),
    zone.offset(asUtcMs + 36 * 3_600_000),
  ]);
  const candidates = [ ...offsetsMin ]
    .map((offMin) => asUtcMs - offMin * 60_000)
    .filter((instant) => zone.offset(instant) * 60_000 === asUtcMs - instant)
    .sort((a, b) => a - b);

  if (candidates.length > 0) {
    return { utc: new Date(candidates[ 0 ]!), exists: true, ambiguous: candidates.length > 1 };
  }

  // Gap: shift forward by the jump, i.e. interpret with the offset in force BEFORE the transition.
  const before = zone.offset(asUtcMs - 36 * 3_600_000);
  return { utc: new Date(asUtcMs - before * 60_000), exists: false, ambiguous: false };
}

/** Converts a local calendar date+time in a given IANA timezone to a UTC Date (see conventions above). */
export function localToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timezone: string): Date {
  return resolveLocalTime(year, month, day, hour, minute, second, timezone).utc;
}

/** Returns the UTC start (00:00:00.000) and end (23:59:59.999) of today in the given IANA timezone. */
export function getTodayBoundsInTz(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  const local = DateTime.fromJSDate(now, { zone: safeZone(timezone) });
  return { start: local.startOf('day').toJSDate(), end: local.endOf('day').toJSDate() };
}

export function getTomorrowUTCRange(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  const tomorrow = DateTime.fromJSDate(now, { zone: safeZone(timezone) }).plus({ days: 1 });
  return {
    start: tomorrow.startOf('day').toJSDate(),
    end: tomorrow.set({ hour: 23, minute: 59, second: 59, millisecond: 0 }).toJSDate(),
  };
}

export function getCurrentMonthBoundsInTz(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  const local = DateTime.fromJSDate(now, { zone: safeZone(timezone) });
  return { start: local.startOf('month').toJSDate(), end: local.endOf('month').toJSDate() };
}
