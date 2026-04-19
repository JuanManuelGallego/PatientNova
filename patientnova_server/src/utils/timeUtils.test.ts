import { describe, it, expect } from 'vitest';
import { getTodayBoundsInTz } from './timeUtils.js';

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
