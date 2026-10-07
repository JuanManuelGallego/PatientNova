import { describe, it, expect } from 'vitest';
import { getTodayBoundsInTz } from '../../../src/utils/time/time-utils.js';

describe('getTodayBoundsInTz', () => {
  it('returns a start and end Date for a valid timezone', () => {
    const { start, end } = getTodayBoundsInTz('America/New_York');
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });

  it('start is before end', () => {
    const { start, end } = getTodayBoundsInTz('America/Toronto');
    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it('the range spans 24 hours minus 1ms', () => {
    const { start, end } = getTodayBoundsInTz('UTC');
    expect(end.getTime() - start.getTime()).toBe(86_400_000 - 1);
  });

  it('falls back to UTC for an invalid timezone', () => {
    const { start: utcStart, end: utcEnd } = getTodayBoundsInTz('UTC');
    const { start: badStart, end: badEnd } = getTodayBoundsInTz('Not/ATimezone');

    // Both should produce the same 24-hour-wide range
    expect(badEnd.getTime() - badStart.getTime()).toBe(86_400_000 - 1);
    // And it should match UTC
    expect(badStart.getTime()).toBe(utcStart.getTime());
    expect(badEnd.getTime()).toBe(utcEnd.getTime());
  });

  it('UTC start time is midnight local time in the given timezone', () => {
    // For UTC timezone, start should be today's midnight UTC
    const { start } = getTodayBoundsInTz('UTC');
    const utcHour = start.getUTCHours();
    const utcMin = start.getUTCMinutes();
    const utcSec = start.getUTCSeconds();
    expect(utcHour).toBe(0);
    expect(utcMin).toBe(0);
    expect(utcSec).toBe(0);
  });
});

import { DateTime } from 'luxon';
import {
  getCurrentMonthBoundsInTz,
  getLocalTimeParts,
  getTomorrowUTCRange,
  isValidIANATimezone,
  localToUtc,
  resolveLocalTime,
} from '../../../src/utils/time/time-utils.js';

const iso = (d: Date) => d.toISOString();
const NY = 'America/New_York';

describe('localToUtc / resolveLocalTime across DST', () => {
  it('handles zones without DST (America/Bogota is UTC-5 all year)', () => {
    expect(iso(localToUtc(2026, 10, 6, 10, 0, 0, 'America/Bogota'))).toBe('2026-10-06T15:00:00.000Z');
    expect(iso(localToUtc(2026, 1, 15, 0, 0, 0, 'America/Bogota'))).toBe('2026-01-15T05:00:00.000Z');
  });

  it('maps ordinary times on both sides of the spring-forward transition', () => {
    // 2026-03-08: 02:00 EST jumps to 03:00 EDT
    expect(iso(localToUtc(2026, 3, 8, 1, 59, 59, NY))).toBe('2026-03-08T06:59:59.000Z');
    expect(iso(localToUtc(2026, 3, 8, 3, 0, 0, NY))).toBe('2026-03-08T07:00:00.000Z');
    expect(iso(localToUtc(2026, 3, 7, 12, 0, 0, NY))).toBe('2026-03-07T17:00:00.000Z'); // EST
    expect(iso(localToUtc(2026, 3, 9, 12, 0, 0, NY))).toBe('2026-03-09T16:00:00.000Z'); // EDT
  });

  it('flags nonexistent local times in the spring-forward gap and shifts them forward', () => {
    const r = resolveLocalTime(2026, 3, 8, 2, 30, 0, NY);
    expect(r.exists).toBe(false);
    expect(r.ambiguous).toBe(false);
    expect(iso(r.utc)).toBe('2026-03-08T07:30:00.000Z'); // 03:30 EDT
    expect(iso(localToUtc(2026, 3, 8, 2, 30, 0, NY))).toBe('2026-03-08T07:30:00.000Z');
    expect(resolveLocalTime(2026, 3, 8, 2, 0, 0, NY).exists).toBe(false);
    expect(resolveLocalTime(2026, 3, 8, 3, 0, 0, NY).exists).toBe(true);
  });

  it('uses the first occurrence for ambiguous fall-back times and flags them', () => {
    // 2026-11-01: 02:00 EDT falls back to 01:00 EST, so 01:30 happens twice
    const r = resolveLocalTime(2026, 11, 1, 1, 30, 0, NY);
    expect(r.exists).toBe(true);
    expect(r.ambiguous).toBe(true);
    expect(iso(r.utc)).toBe('2026-11-01T05:30:00.000Z'); // first (EDT) occurrence
    // unambiguous neighbours
    expect(resolveLocalTime(2026, 11, 1, 0, 30, 0, NY).ambiguous).toBe(false);
    const after = resolveLocalTime(2026, 11, 1, 2, 30, 0, NY);
    expect(after.ambiguous).toBe(false);
    expect(iso(after.utc)).toBe('2026-11-01T07:30:00.000Z'); // EST
  });

  it('works for other transition rules (Europe/London) and half-hour gaps (Lord Howe)', () => {
    const london = resolveLocalTime(2026, 3, 29, 1, 30, 0, 'Europe/London'); // 01:00 -> 02:00 BST
    expect(london.exists).toBe(false);
    expect(iso(london.utc)).toBe('2026-03-29T01:30:00.000Z'); // 02:30 BST

    const lh = resolveLocalTime(2026, 10, 4, 2, 15, 0, 'Australia/Lord_Howe'); // 02:00 -> 02:30
    expect(lh.exists).toBe(false);
    expect(DateTime.fromJSDate(lh.utc, { zone: 'Australia/Lord_Howe' }).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-04 02:45');
  });

  it('throws on an invalid time zone', () => {
    expect(() => localToUtc(2026, 1, 1, 0, 0, 0, 'Not/AZone')).toThrow(RangeError);
    expect(isValidIANATimezone('America/Bogota')).toBe(true);
    expect(isValidIANATimezone('Not/AZone')).toBe(false);
  });
});

describe('day / month bounds across DST', () => {
  it('a spring-forward day is 23h long, a fall-back day 25h', () => {
    const spring = getTodayBoundsInTz(NY, new Date('2026-03-08T15:00:00Z'));
    expect(iso(spring.start)).toBe('2026-03-08T05:00:00.000Z');
    expect(iso(spring.end)).toBe('2026-03-09T03:59:59.999Z');
    expect(spring.end.getTime() - spring.start.getTime() + 1).toBe(23 * 3_600_000);

    const fall = getTodayBoundsInTz(NY, new Date('2026-11-01T15:00:00Z'));
    expect(iso(fall.start)).toBe('2026-11-01T04:00:00.000Z');
    expect(iso(fall.end)).toBe('2026-11-02T04:59:59.999Z');
    expect(fall.end.getTime() - fall.start.getTime() + 1).toBe(25 * 3_600_000);
  });

  it('month bounds use the offset in force at each boundary', () => {
    const march = getCurrentMonthBoundsInTz(NY, new Date('2026-03-20T12:00:00Z'));
    expect(iso(march.start)).toBe('2026-03-01T05:00:00.000Z'); // EST
    expect(iso(march.end)).toBe('2026-04-01T03:59:59.999Z'); // EDT
  });

  it('tomorrow range is computed in local time, also across the DST jump', () => {
    const t = getTomorrowUTCRange(NY, new Date('2026-03-07T18:00:00Z')); // Sat -> tomorrow is the 23h Sunday
    expect(iso(t.start)).toBe('2026-03-08T05:00:00.000Z');
    expect(iso(t.end)).toBe('2026-03-09T03:59:59.000Z');
  });

  it('getLocalTimeParts reports hour 0 at midnight (never 24)', () => {
    const p = getLocalTimeParts('America/Bogota', new Date('2026-10-06T05:00:00Z'));
    expect(p).toEqual({ year: 2026, month: 10, day: 6, hour: 0, minute: 0 });
  });
});
