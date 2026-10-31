import { describe, it, expect } from 'vitest';
import {
  generateSlots,
  isSlotAvailable,
  type Interval,
  type Slot,
  type SlotQuery,
} from '../../../src/public-booking/slot-engine.js';

const MONDAY = 1;
const SUNDAY = 7;

// 2026-11-02 is a Monday; America/Bogota is UTC-5 all year (09:00 local = 14:00Z).
function query(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    timezone: 'America/Bogota',
    rules: [ { weekday: MONDAY, startMinute: 9 * 60, endMinute: 12 * 60 } ],
    fromDate: '2026-11-02',
    toDate: '2026-11-02',
    durationMinutes: 60,
    slotIntervalMinutes: 30,
    bufferMinutes: 0,
    minLeadMinutes: 0,
    maxHorizonDays: 60,
    now: new Date('2026-10-26T00:00:00Z'),
    busy: { appointments: [], blocked: [], holds: [] },
    ...overrides,
  };
}

function busy(parts: Partial<SlotQuery['busy']>): SlotQuery['busy'] {
  return { appointments: [], blocked: [], holds: [], ...parts };
}

function interval(start: string, end: string): Interval {
  return { start: new Date(start), end: new Date(end) };
}

function starts(slots: Slot[]): string[] {
  return slots.map((s) => s.startUtc.toISOString());
}

// Local Bogota time on 2026-11-02 as an ISO instant.
function bogota(hhmm: string): string {
  const [ h, m ] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 10, 2, h! + 5, m!)).toISOString();
}

describe('generateSlots: grid and fit (America/Bogota)', () => {
  it('offers every grid start whose full duration fits the window', () => {
    const slots = generateSlots(query());
    expect(starts(slots)).toEqual([ '09:00', '09:30', '10:00', '10:30', '11:00' ].map(bogota));
    for (const s of slots) expect(s.endUtc.getTime() - s.startUtc.getTime()).toBe(60 * 60_000);
  });

  it('only uses rules for the matching ISO weekday', () => {
    const slots = generateSlots(query({ fromDate: '2026-11-02', toDate: '2026-11-08' }));
    expect(slots).toHaveLength(5);
    expect(slots.every((s) => s.startUtc.toISOString().startsWith('2026-11-02'))).toBe(true);
  });

  it('uses the interval as the grid, independent of the duration (interval > duration)', () => {
    const slots = generateSlots(query({ slotIntervalMinutes: 60, durationMinutes: 30 }));
    expect(starts(slots)).toEqual([ '09:00', '10:00', '11:00' ].map(bogota));
  });

  it('offers nothing when the window is shorter than the duration', () => {
    const slots = generateSlots(query({ rules: [ { weekday: MONDAY, startMinute: 540, endMinute: 570 } ] }));
    expect(slots).toEqual([]);
  });

  it('handles several windows on one day, sorted', () => {
    const slots = generateSlots(query({
      slotIntervalMinutes: 60,
      rules: [
        { weekday: MONDAY, startMinute: 14 * 60, endMinute: 16 * 60 },
        { weekday: MONDAY, startMinute: 9 * 60, endMinute: 11 * 60 },
      ],
    }));
    expect(starts(slots)).toEqual([ '09:00', '10:00', '14:00', '15:00' ].map(bogota));
  });

  it('treats endMinute = 1440 as midnight of the next local date', () => {
    const slots = generateSlots(query({
      slotIntervalMinutes: 60,
      rules: [ { weekday: MONDAY, startMinute: 22 * 60, endMinute: 1440 } ],
    }));
    expect(starts(slots)).toEqual([ '2026-11-03T03:00:00.000Z', '2026-11-03T04:00:00.000Z' ]);
    expect(slots[1]!.endUtc.toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });

  it('never returns duplicate starts, even for overlapping rules', () => {
    const rule = { weekday: MONDAY, startMinute: 540, endMinute: 720 };
    expect(generateSlots(query({ rules: [ rule, rule ] }))).toHaveLength(5);
  });

  it('returns nothing for a reversed date range', () => {
    expect(generateSlots(query({ fromDate: '2026-11-03', toDate: '2026-11-02' }))).toEqual([]);
  });

  it('rejects invalid dates', () => {
    expect(() => generateSlots(query({ fromDate: '2026-02-30' }))).toThrow(RangeError);
  });

  it('rejects a zero, negative or NaN grid interval instead of looping forever', () => {
    for (const slotIntervalMinutes of [ 0, -15, Number.NaN ]) {
      expect(() => generateSlots(query({ slotIntervalMinutes }))).toThrow(RangeError);
      expect(() => isSlotAvailable(new Date(bogota('09:00')), query({ slotIntervalMinutes }))).toThrow(RangeError);
    }
  });
});

describe('generateSlots: date range clamp', () => {
  it('only walks dates between the lead time and the horizon', () => {
    const narrow = generateSlots(query({ fromDate: '2026-10-26', toDate: '2026-12-31' }));
    const started = performance.now();
    const wide = generateSlots(query({ fromDate: '0001-01-01', toDate: '9999-12-31' }));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(starts(wide)).toEqual(starts(narrow));
    expect(wide.length).toBeGreaterThan(0);
  });

  it('returns nothing for a range entirely in the past or past the horizon', () => {
    expect(generateSlots(query({ fromDate: '2020-01-06', toDate: '2020-12-28' }))).toEqual([]);
    expect(generateSlots(query({ fromDate: '2030-01-07', toDate: '2030-12-30' }))).toEqual([]);
  });
});

describe('generateSlots: busy time and buffer', () => {
  // A 10:00-11:00 appointment; 30-minute slots on a 15-minute grid in 09:00-12:00.
  const appt = interval(bogota('10:00'), bogota('11:00'));
  const grid = { durationMinutes: 30, slotIntervalMinutes: 15 };

  it('ignores the buffer at window edges', () => {
    expect(starts(generateSlots(query({ bufferMinutes: 30 })))).toEqual(starts(generateSlots(query())));
  });

  it('allows back-to-back appointments with buffer 0 (half-open)', () => {
    const slots = generateSlots(query({ slotIntervalMinutes: 60, busy: busy({ appointments: [ appt ] }) }));
    expect(starts(slots)).toEqual([ '09:00', '11:00' ].map(bogota));
  });

  it('expands appointments by the buffer on both sides', () => {
    const slots = generateSlots(query({ ...grid, bufferMinutes: 15, busy: busy({ appointments: [ appt ] }) }));
    expect(starts(slots)).toEqual([ '09:00', '09:15', '11:15', '11:30' ].map(bogota));
  });

  it('expands holds exactly like appointments', () => {
    const slots = generateSlots(query({ ...grid, bufferMinutes: 15, busy: busy({ holds: [ appt ] }) }));
    expect(starts(slots)).toEqual([ '09:00', '09:15', '11:15', '11:30' ].map(bogota));
  });

  it('does not expand blocked time by the buffer', () => {
    const slots = generateSlots(query({ ...grid, bufferMinutes: 15, busy: busy({ blocked: [ appt ] }) }));
    expect(starts(slots)).toEqual([ '09:00', '09:15', '09:30', '11:00', '11:15', '11:30' ].map(bogota));
  });

  it('handles unsorted, overlapping and touching busy intervals', () => {
    const slots = generateSlots(query({
      ...grid,
      busy: busy({
        appointments: [ interval(bogota('11:00'), bogota('11:15')) ],
        blocked: [
          interval(bogota('10:00'), bogota('10:30')),
          interval(bogota('09:45'), bogota('10:15')),
          interval(bogota('10:30'), bogota('10:45')),
        ],
      }),
    }));
    expect(starts(slots)).toEqual([ '09:00', '09:15', '11:15', '11:30' ].map(bogota));
  });

  it('treats a zero-length busy point strictly inside a slot as a conflict', () => {
    const point = interval(bogota('10:10'), bogota('10:10'));
    const result = starts(generateSlots(query({ ...grid, busy: busy({ blocked: [ point ] }) })));
    expect(result).not.toContain(bogota('09:45'));
    expect(result).not.toContain(bogota('10:00'));
    expect(result).toContain(bogota('09:30'));
    expect(result).toContain(bogota('10:15'));
  });

  it('ignores busy time on other days', () => {
    const other = interval('2026-11-03T15:00:00Z', '2026-11-03T16:00:00Z');
    expect(generateSlots(query({ busy: busy({ appointments: [ other ], blocked: [ other ] }) }))).toHaveLength(5);
  });
});

describe('generateSlots: lead time and horizon', () => {
  it('drops starts earlier than now + minLeadMinutes', () => {
    const slots = generateSlots(query({ now: new Date(bogota('09:10')), minLeadMinutes: 60 }));
    expect(starts(slots)).toEqual([ '10:30', '11:00' ].map(bogota));
  });

  it('cuts at the start of the local day maxHorizonDays after today', () => {
    // Now: Monday 2026-10-26 10:00 Bogota. Horizon 7 days ends at 2026-11-02 00:00 local.
    const base = { fromDate: '2026-10-26', toDate: '2026-11-02', now: new Date('2026-10-26T15:00:00Z') };
    const seven = generateSlots(query({ ...base, maxHorizonDays: 7 }));
    expect(starts(seven)).toEqual([
      '2026-10-26T15:00:00.000Z', '2026-10-26T15:30:00.000Z', '2026-10-26T16:00:00.000Z',
    ]);
    const eight = generateSlots(query({ ...base, maxHorizonDays: 8 }));
    expect(eight).toHaveLength(3 + 5);
  });
});

describe('generateSlots: time zone offsets', () => {
  it('resolves each date with its own offset (New York winter vs summer)', () => {
    const ny = { timezone: 'America/New_York', now: new Date('2026-01-01T00:00:00Z'), maxHorizonDays: 365, durationMinutes: 60 };
    const rules = [ { weekday: MONDAY, startMinute: 9 * 60, endMinute: 10 * 60 } ];
    // 09:00 EST (UTC-5) in January, 09:00 EDT (UTC-4) in July.
    expect(starts(generateSlots(query({ ...ny, rules, fromDate: '2026-01-05', toDate: '2026-01-05' })))).toEqual([ '2026-01-05T14:00:00.000Z' ]);
    expect(starts(generateSlots(query({ ...ny, rules, fromDate: '2026-07-06', toDate: '2026-07-06' })))).toEqual([ '2026-07-06T13:00:00.000Z' ]);
  });
});

describe('isSlotAvailable', () => {
  const rules = query();

  it('accepts every generated start', () => {
    for (const s of generateSlots(rules)) expect(isSlotAvailable(s.startUtc, rules)).toBe(true);
  });

  it('rejects off-grid starts', () => {
    expect(isSlotAvailable(new Date(bogota('09:10')), rules)).toBe(false);
  });

  it('rejects starts outside a window or whose duration does not fit', () => {
    expect(isSlotAvailable(new Date(bogota('08:30')), rules)).toBe(false);
    expect(isSlotAvailable(new Date(bogota('11:30')), rules)).toBe(false);
    expect(isSlotAvailable(new Date('2026-11-03T14:00:00Z'), rules)).toBe(false);
  });

  it('rejects starts that conflict with buffered busy time', () => {
    const withAppt = query({ bufferMinutes: 30, busy: busy({ appointments: [ interval(bogota('10:00'), bogota('11:00')) ] }) });
    expect(isSlotAvailable(new Date(bogota('11:00')), withAppt)).toBe(false);
    expect(isSlotAvailable(new Date(bogota('09:00')), withAppt)).toBe(false);
  });

  it('rejects starts inside the lead time or past the horizon', () => {
    expect(isSlotAvailable(new Date(bogota('09:00')), query({ now: new Date(bogota('08:30')), minLeadMinutes: 60 }))).toBe(false);
    expect(isSlotAvailable(new Date(bogota('09:00')), query({ maxHorizonDays: 7 }))).toBe(false);
  });

  it('returns false for an invalid start instead of throwing', () => {
    expect(isSlotAvailable(new Date('garbage'), rules)).toBe(false);
  });

  it('rejects starts with seconds or milliseconds off the minute', () => {
    expect(isSlotAvailable(new Date(Date.parse(bogota('09:00')) + 1), rules)).toBe(false);
    expect(isSlotAvailable(new Date(Date.parse(bogota('09:00')) + 1000), rules)).toBe(false);
  });

  it('agrees with generateSlots on every 5-minute instant, including DST nights', () => {
    const ny = { timezone: 'America/New_York', now: new Date('2026-01-01T00:00:00Z'), maxHorizonDays: 365 };
    const sunday = { durationMinutes: 30, rules: [ { weekday: SUNDAY, startMinute: 0, endMinute: 240 } ] };
    const cases = [
      query({ ...ny, ...sunday, fromDate: '2026-03-08', toDate: '2026-03-08' }),
      query({ ...ny, ...sunday, fromDate: '2026-11-01', toDate: '2026-11-01' }),
      query({ bufferMinutes: 15, busy: busy({ appointments: [ interval(bogota('10:00'), bogota('10:30')) ] }) }),
    ];
    for (const q of cases) {
      const generated = new Set(starts(generateSlots(q)));
      const first = Date.parse(q.fromDate + 'T00:00:00Z');
      for (let t = first; t < first + 2 * 86_400_000; t += 5 * 60_000) {
        const at = new Date(t);
        expect(isSlotAvailable(at, q), at.toISOString()).toBe(generated.has(at.toISOString()));
      }
    }
  });

  it('resolves the local date in the provider zone (late window, next UTC day)', () => {
    const late = query({ slotIntervalMinutes: 60, rules: [ { weekday: MONDAY, startMinute: 22 * 60, endMinute: 1440 } ] });
    expect(isSlotAvailable(new Date('2026-11-03T04:00:00Z'), late)).toBe(true);
  });
});
