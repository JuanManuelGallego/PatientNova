import { describe, it, expect } from 'vitest';
import { replaceAvailabilitySchema, updateBookingSettingsSchema } from '../../../src/booking-settings/booking-settings.schemas.js';

describe('updateBookingSettingsSchema', () => {
  it('rejects an empty body', () => {
    expect(updateBookingSettingsSchema.safeParse({}).success).toBe(false);
  });

  it('trims and lowercases the slug', () => {
    const r = updateBookingSettingsSchema.parse({ bookingSlug: '  Dra-Maria ' });
    expect(r.bookingSlug).toBe('dra-maria');
  });

  it('accepts null to clear the slug', () => {
    expect(updateBookingSettingsSchema.parse({ bookingSlug: null }).bookingSlug).toBeNull();
  });

  it.each([ 'ab', 'login', 'a--b', 'peña', 'dra maria' ])('rejects slug %s', (bookingSlug) => {
    expect(updateBookingSettingsSchema.safeParse({ bookingSlug }).success).toBe(false);
  });

  it('only accepts the listed slot intervals', () => {
    expect(updateBookingSettingsSchema.safeParse({ slotIntervalMinutes: 30 }).success).toBe(true);
    expect(updateBookingSettingsSchema.safeParse({ slotIntervalMinutes: 25 }).success).toBe(false);
  });

  it('bounds buffer, lead time and horizon', () => {
    expect(updateBookingSettingsSchema.safeParse({ bufferMinutes: -1 }).success).toBe(false);
    expect(updateBookingSettingsSchema.safeParse({ bufferMinutes: 241 }).success).toBe(false);
    expect(updateBookingSettingsSchema.safeParse({ minLeadMinutes: 14 * 24 * 60 + 1 }).success).toBe(false);
    expect(updateBookingSettingsSchema.safeParse({ maxHorizonDays: 0 }).success).toBe(false);
    expect(updateBookingSettingsSchema.safeParse({ maxHorizonDays: 366 }).success).toBe(false);
    expect(updateBookingSettingsSchema.safeParse({ bufferMinutes: 10, minLeadMinutes: 0, maxHorizonDays: 365 }).success).toBe(true);
  });

  it('does not accept the approval mode yet', () => {
    const r = updateBookingSettingsSchema.parse({ bookingEnabled: false, bookingApprovalMode: 'REQUIRE_APPROVAL' } as Record<string, unknown>);
    expect(r).not.toHaveProperty('bookingApprovalMode');
  });
});

describe('replaceAvailabilitySchema', () => {
  const rule = (weekday: number, startMinute: number, endMinute: number) => ({ weekday, startMinute, endMinute });

  it('accepts an empty week', () => {
    expect(replaceAvailabilitySchema.safeParse({ rules: [] }).success).toBe(true);
  });

  it('accepts touching windows on the same day and the full day', () => {
    expect(replaceAvailabilitySchema.safeParse({ rules: [ rule(1, 540, 720), rule(1, 720, 840), rule(7, 0, 1440) ] }).success).toBe(true);
  });

  it('rejects overlapping windows on the same weekday regardless of order', () => {
    const r = replaceAvailabilitySchema.safeParse({ rules: [ rule(2, 600, 720), rule(2, 540, 660) ] });
    expect(r.success).toBe(false);
  });

  it('allows the same hours on different weekdays', () => {
    expect(replaceAvailabilitySchema.safeParse({ rules: [ rule(1, 540, 720), rule(2, 540, 720) ] }).success).toBe(true);
  });

  it.each([
    [ 'end before start', rule(1, 600, 540) ],
    [ 'zero-length', rule(1, 600, 600) ],
    [ 'past midnight', rule(1, 1380, 1445) ],
    [ 'off the 5-minute grid', rule(1, 541, 600) ],
    [ 'weekday 0', rule(0, 540, 600) ],
    [ 'weekday 8', rule(8, 540, 600) ],
  ])('rejects %s', (_label, r) => {
    expect(replaceAvailabilitySchema.safeParse({ rules: [ r ] }).success).toBe(false);
  });

  it('caps the number of windows', () => {
    const rules = Array.from({ length: 51 }, (_, i) => rule((i % 7) + 1, (Math.floor(i / 7)) * 60, (Math.floor(i / 7)) * 60 + 30));
    expect(replaceAvailabilitySchema.safeParse({ rules }).success).toBe(false);
  });
});
