import { describe, expect, it } from 'vitest';
import { AppointmentStatus, BookingRequestStatus } from '../../../generated/prisma/enums.js';
import { confirmationState } from '../../../src/portal/booking-confirmation.dto.js';

const now = new Date('2026-11-10T12:00:00Z');
const past = new Date('2026-11-10T11:00:00Z');
const future = new Date('2026-11-10T13:00:00Z');

type Row = Parameters<typeof confirmationState>[0];
const row = (over: Partial<Row>): Row => ({
  status: BookingRequestStatus.UNCONFIRMED, confirmedAt: null, resolvedBy: null, holdExpiresAt: future, appointment: null, ...over,
});
const approved = (appointment: Row['appointment']) =>
  row({ status: BookingRequestStatus.APPROVED, confirmedAt: past, resolvedBy: 'patient', appointment });

describe('confirmationState', () => {
  it.each([
    [ 'released by the patient before confirming', row({ status: BookingRequestStatus.CANCELLED, resolvedBy: 'patient' }), 'expired' ],
    [ 'expired without confirming', row({ status: BookingRequestStatus.EXPIRED, holdExpiresAt: past }), 'expired' ],
    [ 'expired after confirming', row({ status: BookingRequestStatus.EXPIRED, confirmedAt: past, holdExpiresAt: past }), 'unavailable' ],
    [ 'pending past its hold, before the sweep', row({ status: BookingRequestStatus.PENDING, confirmedAt: past, holdExpiresAt: past }), 'unavailable' ],
    [ 'pending and live', row({ status: BookingRequestStatus.PENDING, confirmedAt: past }), 'requested' ],
    [ 'rejected by the provider', row({ status: BookingRequestStatus.REJECTED, confirmedAt: past, resolvedBy: 'provider' }), 'unavailable' ],
    [ 'cancelled after confirming', row({ status: BookingRequestStatus.CANCELLED, confirmedAt: past, resolvedBy: 'patient' }), 'unavailable' ],
    [ 'cancelled by the system at confirm', row({ status: BookingRequestStatus.CANCELLED, resolvedBy: 'system' }), 'unavailable' ],
    [ 'unconfirmed and live', row({}), 'unconfirmed' ],
    [ 'unconfirmed past its hold', row({ holdExpiresAt: past }), 'expired' ],
    [ 'approved, appointment confirmed', approved({ status: AppointmentStatus.CONFIRMED, isDeleted: false }), 'confirmed' ],
    [ 'approved, appointment scheduled', approved({ status: AppointmentStatus.SCHEDULED, isDeleted: false }), 'confirmed' ],
    [ 'approved, appointment cancelled since', approved({ status: AppointmentStatus.CANCELLED, isDeleted: false }), 'unavailable' ],
    [ 'approved, appointment deleted since', approved({ status: AppointmentStatus.CONFIRMED, isDeleted: true }), 'unavailable' ],
    [ 'approved, appointment removed (link set null)', approved(null), 'unavailable' ],
  ])('%s', (_name, input, expected) => {
    expect(confirmationState(input, now)).toBe(expected);
  });
});
