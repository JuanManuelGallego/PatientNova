import { describe, expect, it } from 'vitest';
import { HOLD_HOURS, holdExpiry } from '../../../src/booking-requests/booking-request.constants.js';

const HOUR_MS = 3_600_000;

describe('holdExpiry', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');

  it('lasts HOLD_HOURS when the slot is further away', () => {
    const start = new Date(now.getTime() + 10 * 24 * HOUR_MS);
    expect(holdExpiry(now, start).getTime()).toBe(now.getTime() + HOLD_HOURS * HOUR_MS);
  });

  it('never outlives the start of the slot', () => {
    const start = new Date(now.getTime() + 5 * HOUR_MS);
    expect(holdExpiry(now, start)).toEqual(start);
  });

  it('is exactly HOLD_HOURS when the slot starts then', () => {
    const start = new Date(now.getTime() + HOLD_HOURS * HOUR_MS);
    expect(holdExpiry(now, start)).toEqual(start);
  });
});

describe('unconfirmedHoldExpiry', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');

  it('lasts UNCONFIRMED_HOLD_MINUTES, capped at the start of the slot', async () => {
    const { unconfirmedHoldExpiry, UNCONFIRMED_HOLD_MINUTES } = await import('../../../src/booking-requests/booking-request.constants.js');
    expect(UNCONFIRMED_HOLD_MINUTES).toBe(15);
    expect(unconfirmedHoldExpiry(now, new Date(now.getTime() + 5 * HOUR_MS)).getTime()).toBe(now.getTime() + 15 * 60_000);
    const soon = new Date(now.getTime() + 5 * 60_000);
    expect(unconfirmedHoldExpiry(now, soon)).toEqual(soon);
  });
});
