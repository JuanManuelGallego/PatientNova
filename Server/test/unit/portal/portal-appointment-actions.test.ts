import { describe, expect, it } from 'vitest';
import { AppointmentStatus, RecordSource } from '../../../generated/prisma/enums.js';
import { canCancel, canReschedule, type ActionableAppointment } from '../../../src/portal/portal-appointment-actions.js';

const NOW = new Date('2026-11-02T15:00:00Z');
const bookable = { bookableOnline: true, isActive: true, isDeleted: false };

function appt(overrides: Partial<ActionableAppointment> = {}): ActionableAppointment {
  return {
    status: AppointmentStatus.CONFIRMED,
    isDeleted: false,
    startAt: new Date('2026-11-05T15:00:00Z'),
    source: RecordSource.PORTAL,
    appointmentType: { ...bookable },
    appointmentLocation: { ...bookable, isVirtual: false },
    ...overrides,
  };
}

const ctx = { now: NOW, canBook: true };

describe('canCancel', () => {
  it('allows any upcoming active appointment, with no cutoff', () => {
    expect(canCancel(appt(), NOW)).toBe(true);
    expect(canCancel(appt({ status: AppointmentStatus.SCHEDULED, source: RecordSource.PROVIDER }), NOW)).toBe(true);
    expect(canCancel(appt({ startAt: new Date(NOW.getTime() + 60_000) }), NOW)).toBe(true);
  });

  it('refuses started, past, inactive and deleted appointments', () => {
    expect(canCancel(appt({ startAt: NOW }), NOW)).toBe(false);
    expect(canCancel(appt({ startAt: new Date(NOW.getTime() - 60_000) }), NOW)).toBe(false);
    for (const status of [ AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW ]) {
      expect(canCancel(appt({ status }), NOW)).toBe(false);
    }
    expect(canCancel(appt({ isDeleted: true }), NOW)).toBe(false);
  });
});

describe('canReschedule', () => {
  it('allows the patient\'s own online booking while its type and location are bookable', () => {
    expect(canReschedule(appt(), ctx)).toBe(true);
  });

  it('refuses provider-created appointments', () => {
    expect(canReschedule(appt({ source: RecordSource.PROVIDER }), ctx)).toBe(false);
  });

  it('refuses when booking is not open in auto-confirm mode', () => {
    expect(canReschedule(appt(), { ...ctx, canBook: false })).toBe(false);
  });

  it('refuses when the type or location stopped being bookable, or is missing', () => {
    for (const change of [ { bookableOnline: false }, { isActive: false }, { isDeleted: true } ]) {
      expect(canReschedule(appt({ appointmentType: { ...bookable, ...change } }), ctx)).toBe(false);
      expect(canReschedule(appt({ appointmentLocation: { ...bookable, isVirtual: false, ...change } }), ctx)).toBe(false);
    }
    expect(canReschedule(appt({ appointmentType: null }), ctx)).toBe(false);
    expect(canReschedule(appt({ appointmentLocation: null }), ctx)).toBe(false);
  });

  it('refuses virtual locations until 5.4', () => {
    expect(canReschedule(appt({ appointmentLocation: { ...bookable, isVirtual: true } }), ctx)).toBe(false);
  });

  it('refuses whatever cannot be cancelled', () => {
    expect(canReschedule(appt({ status: AppointmentStatus.CANCELLED }), ctx)).toBe(false);
    expect(canReschedule(appt({ startAt: NOW }), ctx)).toBe(false);
  });
});
