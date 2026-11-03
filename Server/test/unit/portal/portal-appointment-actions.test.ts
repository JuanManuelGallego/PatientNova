import { describe, expect, it } from 'vitest';
import { AppointmentStatus, BookingApprovalMode, RecordSource } from '../../../generated/prisma/enums.js';
import {
  canCancel,
  canReschedule,
  portalActionContext,
  type ActionableAppointment,
  type PortalActionContext,
} from '../../../src/portal/portal-appointment-actions.js';

const NOW = new Date('2026-11-02T15:00:00Z');
const HOUR = 3_600_000;
const bookable = { bookableOnline: true, isActive: true, isDeleted: false };

function appt(overrides: Partial<ActionableAppointment> = {}): ActionableAppointment {
  return {
    status: AppointmentStatus.CONFIRMED,
    isDeleted: false,
    startAt: new Date('2026-11-05T15:00:00Z'),
    source: RecordSource.PORTAL,
    patientRescheduleCount: 0,
    appointmentType: { ...bookable },
    appointmentLocation: { ...bookable },
    ...overrides,
  };
}

const ctx: PortalActionContext = { now: NOW, canBook: true, maxReschedules: 2, minNoticeMs: 0 };

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
      expect(canReschedule(appt({ appointmentLocation: { ...bookable, ...change } }), ctx)).toBe(false);
    }
    expect(canReschedule(appt({ appointmentType: null }), ctx)).toBe(false);
    expect(canReschedule(appt({ appointmentLocation: null }), ctx)).toBe(false);
  });


  it('caps reschedules per appointment at the provider\'s limit (0 = none)', () => {
    expect(canReschedule(appt({ patientRescheduleCount: 1 }), ctx)).toBe(true);
    expect(canReschedule(appt({ patientRescheduleCount: 2 }), ctx)).toBe(false);
    expect(canReschedule(appt(), { ...ctx, maxReschedules: 0 })).toBe(false);
  });

  it('refuses once the current start is within the provider\'s notice; cancelling has no notice', () => {
    const startAt = new Date(NOW.getTime() + 24 * HOUR);
    expect(canReschedule(appt({ startAt }), { ...ctx, minNoticeMs: 23 * HOUR })).toBe(true);
    expect(canReschedule(appt({ startAt }), { ...ctx, minNoticeMs: 24 * HOUR })).toBe(false);
    expect(canCancel(appt({ startAt }), NOW)).toBe(true);
  });

  it('refuses whatever cannot be cancelled', () => {
    expect(canReschedule(appt({ status: AppointmentStatus.CANCELLED }), ctx)).toBe(false);
    expect(canReschedule(appt({ startAt: NOW }), ctx)).toBe(false);
  });
});

describe('portalActionContext', () => {
  const settings = {
    bookingApprovalMode: BookingApprovalMode.AUTO_CONFIRM,
    maxPatientReschedules: 3,
    minRescheduleNoticeHours: 12,
  };

  it('maps the provider settings and liveness', () => {
    expect(portalActionContext(settings, true, NOW)).toEqual({ now: NOW, canBook: true, maxReschedules: 3, minNoticeMs: 12 * HOUR });
  });

  it('cannot book while booking is paused or in approval mode', () => {
    expect(portalActionContext(settings, false, NOW).canBook).toBe(false);
    expect(portalActionContext({ ...settings, bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL }, true, NOW).canBook).toBe(false);
  });
});
