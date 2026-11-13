import { z } from 'zod';
import { e164OrEmpty, e164Regex } from '../utils/validation/middleware.js';
import { isValidIANATimezone } from '../utils/time/time-utils.js';

export const createPortalBookingSchema = z.strictObject({
  typeId: z.uuid('Invalid typeId'),
  locationId: z.uuid('Invalid locationId'),
  startUtc: z.iso.datetime({ message: 'startUtc must be an ISO date-time in UTC' }),
  patientTimezone: z.string().max(50).refine(isValidIANATimezone, { message: 'Invalid IANA timezone identifier' }),
  consentAccepted: z.literal(true),
  patient: z.strictObject({
    name: z.string().trim().min(1, 'name is required').max(100),
    lastName: z.string().trim().min(1, 'lastName is required').max(100),
    phone: e164OrEmpty.optional(),
  }).optional(),
});

export type CreatePortalBookingBody = z.infer<typeof createPortalBookingSchema>;

/** The new start and the device zone only: the end, price and type come from the server. */
export const reschedulePortalAppointmentSchema = createPortalBookingSchema.pick({ startUtc: true, patientTimezone: true }).strict();

export type ReschedulePortalAppointmentBody = z.infer<typeof reschedulePortalAppointmentSchema>;

const startEmail = z.string().trim().toLowerCase().max(254).pipe(z.email('Must be a valid email address'));
const startPhone = z.string().trim().regex(e164Regex, 'Phone must be E.164 format (e.g. +573001234567)');

export const startBookingSchema = z.strictObject({
  typeId: createPortalBookingSchema.shape.typeId,
  locationId: createPortalBookingSchema.shape.locationId,
  startUtc: createPortalBookingSchema.shape.startUtc,
  patientTimezone: createPortalBookingSchema.shape.patientTimezone,
  consentAccepted: z.literal(true),
  captchaToken: z.string().max(2048),
  patient: z.strictObject({
    name: z.string().trim().min(1, 'name is required').max(100),
    lastName: z.string().trim().min(1, 'lastName is required').max(100),
    phone: e164OrEmpty.optional(),
  }),
  contact: z.discriminatedUnion('channel', [
    z.strictObject({ channel: z.literal('EMAIL'), email: startEmail }),
    z.strictObject({ channel: z.literal('WHATSAPP'), phone: startPhone }),
  ]),
}).superRefine((body, ctx) => {
  if (body.contact.channel === 'WHATSAPP' && body.patient.phone) {
    ctx.addIssue({ code: 'custom', path: [ 'patient', 'phone' ], message: 'phone is only for email bookings' });
  }
});

export type StartBookingBody = z.infer<typeof startBookingSchema>;

export const releaseBookingSchema = z.strictObject({ releaseToken: z.string().max(128) });

export type ReleaseBookingBody = z.infer<typeof releaseBookingSchema>;

export const bookingTokenSchema = z.strictObject({ token: z.string().min(1).max(128) });

export type BookingTokenBody = z.infer<typeof bookingTokenSchema>;
