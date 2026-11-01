import { DateTime } from 'luxon';
import { localToUtc } from '../utils/time/time-utils.js';

export interface Interval {
  start: Date;
  end: Date;
}

export interface Slot {
  startUtc: Date;
  endUtc: Date;
}

export interface AvailabilityWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface SlotRules {
  timezone: string;
  rules: AvailabilityWindow[];
  durationMinutes: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  maxHorizonDays: number;
  now: Date;
  busy: {
    appointments: Interval[];
    blocked: Interval[];
    holds: Interval[];
  };
}

export interface SlotQuery extends SlotRules {
  fromDate: string;
  toDate: string;
}

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 1440;

interface MsInterval {
  start: number;
  end: number;
}

interface Context {
  timezone: string;
  rules: AvailabilityWindow[];
  slotIntervalMinutes: number;
  durationMs: number;
  earliest: number;
  horizon: number;
  busy: MsInterval[];
}

function buildContext(input: SlotRules): Context {
  if (!(input.slotIntervalMinutes > 0)) throw new RangeError('slotIntervalMinutes must be positive');
  const now = input.now.getTime();
  const bufferMs = input.bufferMinutes * MINUTE_MS;
  const expand = (i: Interval, by: number): MsInterval => ({ start: i.start.getTime() - by, end: i.end.getTime() + by });
  return {
    timezone: input.timezone,
    rules: input.rules,
    slotIntervalMinutes: input.slotIntervalMinutes,
    durationMs: input.durationMinutes * MINUTE_MS,
    earliest: now + input.minLeadMinutes * MINUTE_MS,
    horizon: DateTime.fromMillis(now, { zone: input.timezone }).startOf('day').plus({ days: input.maxHorizonDays }).toMillis(),
    busy: [
      ...input.busy.appointments.map((i) => expand(i, bufferMs)),
      ...input.busy.holds.map((i) => expand(i, bufferMs)),
      ...input.busy.blocked.map((i) => expand(i, 0)),
    ],
  };
}

function parseCalendarDate(date: string): DateTime {
  const dt = DateTime.fromISO(date, { zone: 'UTC' });
  if (!dt.isValid || dt.toISODate() !== date) throw new RangeError(`Invalid calendar date: ${date}`);
  return dt;
}

function calendarDayOf(ms: number, timezone: string): DateTime {
  const local = DateTime.fromMillis(ms, { zone: timezone });
  return DateTime.utc(local.year, local.month, local.day);
}

function localMinute(day: DateTime, minute: number, timezone: string): number {
  const d = day.plus({ days: Math.floor(minute / MINUTES_PER_DAY) });
  const m = minute % MINUTES_PER_DAY;
  return localToUtc(d.year, d.month, d.day, Math.floor(m / 60), m % 60, 0, timezone).getTime();
}

function windowOf(ctx: Context, day: DateTime, rule: AvailabilityWindow): MsInterval {
  return { start: localMinute(day, rule.startMinute, ctx.timezone), end: localMinute(day, rule.endMinute, ctx.timezone) };
}

function isFree(ctx: Context, start: number, window: MsInterval): boolean {
  const end = start + ctx.durationMs;
  return end <= window.end && start >= ctx.earliest && start < ctx.horizon && !ctx.busy.some((b) => start < b.end && b.start < end);
}

export function generateSlots(input: SlotQuery): Slot[] {
  const ctx = buildContext(input);
  const from = DateTime.max(parseCalendarDate(input.fromDate), calendarDayOf(ctx.earliest, ctx.timezone));
  const to = DateTime.min(parseCalendarDate(input.toDate), calendarDayOf(ctx.horizon, ctx.timezone));
  const stepMs = ctx.slotIntervalMinutes * MINUTE_MS;

  const byStart = new Map<number, Slot>();
  for (let day = from; day <= to; day = day.plus({ days: 1 })) {
    for (const rule of ctx.rules) {
      if (rule.weekday !== day.weekday) continue;
      const window = windowOf(ctx, day, rule);
      for (let start = window.start; start < window.end; start += stepMs) {
        if (isFree(ctx, start, window)) byStart.set(start, { startUtc: new Date(start), endUtc: new Date(start + ctx.durationMs) });
      }
    }
  }
  return [ ...byStart.values() ].sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
}

export function isSlotAvailable(startUtc: Date, input: SlotRules): boolean {
  const ctx = buildContext(input);
  const target = startUtc instanceof Date ? startUtc.getTime() : Number.NaN;
  if (Number.isNaN(target)) return false;

  const day = calendarDayOf(target, ctx.timezone);
  const stepMs = ctx.slotIntervalMinutes * MINUTE_MS;
  return ctx.rules.some((rule) => {
    if (rule.weekday !== day.weekday) return false;
    const window = windowOf(ctx, day, rule);
    return target >= window.start && (target - window.start) % stepMs === 0 && isFree(ctx, target, window);
  });
}
