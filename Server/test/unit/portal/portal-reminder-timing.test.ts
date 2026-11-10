import { describe, expect, it } from 'vitest';
import { PortalReminderTiming } from '../../../generated/prisma/enums.js';
import { portalReminderSendAt } from '../../../src/portal/portal-reminder-timing.js';

const BOGOTA = 'America/Bogota';
const MADRID = 'Europe/Madrid';
const at = (iso: string) => new Date(iso);
const sendAt = (start: string, timing: PortalReminderTiming, zone = BOGOTA) =>
  portalReminderSendAt(at(start), timing, zone)?.toISOString() ?? null;

describe('portalReminderSendAt', () => {
  const START = '2026-12-10T15:00:00.000Z';

  it('sends nothing for NONE', () => {
    expect(sendAt(START, PortalReminderTiming.NONE)).toBeNull();
  });

  it('subtracts the relative presets in real time', () => {
    expect(sendAt(START, PortalReminderTiming.ONE_HOUR_BEFORE)).toBe('2026-12-10T14:00:00.000Z');
    expect(sendAt(START, PortalReminderTiming.ONE_DAY_BEFORE)).toBe('2026-12-09T15:00:00.000Z');
  });

  it('places the clock presets at wall-clock times in the zone', () => {
    expect(sendAt(START, PortalReminderTiming.SAME_DAY_MORNING)).toBe('2026-12-10T13:00:00.000Z');
    expect(sendAt(START, PortalReminderTiming.PREVIOUS_DAY_MORNING)).toBe('2026-12-09T14:00:00.000Z');
    expect(sendAt(START, PortalReminderTiming.PREVIOUS_DAY_EVENING)).toBe('2026-12-09T23:00:00.000Z');
  });

  it('takes the appointment date in the zone, not in UTC', () => {
    expect(sendAt('2026-12-10T03:00:00.000Z', PortalReminderTiming.SAME_DAY_MORNING)).toBe('2026-12-09T13:00:00.000Z');
  });

  it('keeps the wall-clock time across a DST change', () => {
    const start = '2026-03-30T08:00:00.000Z';
    expect(sendAt(start, PortalReminderTiming.PREVIOUS_DAY_EVENING, MADRID)).toBe('2026-03-29T16:00:00.000Z');
    expect(sendAt(start, PortalReminderTiming.PREVIOUS_DAY_MORNING, MADRID)).toBe('2026-03-29T07:00:00.000Z');
  });
});
