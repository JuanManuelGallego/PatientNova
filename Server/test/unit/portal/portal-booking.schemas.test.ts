import { describe, expect, it } from 'vitest';
import { createPortalBookingSchema } from '../../../src/portal/portal-booking.schemas.ts';

const valid = {
  typeId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  locationId: '7a2b3c4d-5e6f-4a70-8b9c-0d1e2f3a4b5c',
  startUtc: '2026-11-05T14:00:00.000Z',
  patientTimezone: 'America/Bogota',
  consentAccepted: true,
  patient: { name: ' Lucia ', lastName: 'Rojas' },
};

describe('createPortalBookingSchema', () => {
  it('accepts a minimal booking and trims the typed names', () => {
    const parsed = createPortalBookingSchema.parse(valid);
    expect(parsed.patient).toEqual({ name: 'Lucia', lastName: 'Rojas' });
  });

  it('accepts an optional E.164 or empty phone', () => {
    expect(createPortalBookingSchema.safeParse({ ...valid, patient: { ...valid.patient, phone: '+573001112233' } }).success).toBe(true);
    expect(createPortalBookingSchema.safeParse({ ...valid, patient: { ...valid.patient, phone: '' } }).success).toBe(true);
    expect(createPortalBookingSchema.safeParse({ ...valid, patient: { ...valid.patient, phone: '3001112233' } }).success).toBe(false);
  });

  it.each([
    [ 'consent not accepted', { consentAccepted: false } ],
    [ 'invalid zone', { patientTimezone: 'Not/AZone' } ],
    [ 'non-UTC start', { startUtc: '2026-11-05T09:00:00-05:00' } ],
    [ 'client price', { price: 0 } ],
    [ 'client end time', { endUtc: '2026-11-05T15:00:00.000Z' } ],
    [ 'client status', { status: 'CONFIRMED' } ],
    [ 'extra patient field', { patient: { ...valid.patient, email: 'x@y.co' } } ],
  ])('rejects %s', (_label, override) => {
    expect(createPortalBookingSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
