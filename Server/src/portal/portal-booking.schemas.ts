import { z } from 'zod';
import { e164OrEmpty } from '../utils/validation/middleware.js';
import { isValidIANATimezone } from '../utils/time/time-utils.js';

// Strict: price, duration, end time and status are derived server-side and rejected if sent.
export const createPortalBookingSchema = z.strictObject({
  typeId: z.uuid('Invalid typeId'),
  locationId: z.uuid('Invalid locationId'),
  startUtc: z.iso.datetime({ message: 'startUtc must be an ISO date-time in UTC' }),
  patientTimezone: z.string().max(50).refine(isValidIANATimezone, { message: 'Invalid IANA timezone identifier' }),
  consentAccepted: z.literal(true),
  // Applied only when the booking creates a new patient; an existing patient is never updated.
  patient: z.strictObject({
    name: z.string().trim().min(1, 'name is required').max(100),
    lastName: z.string().trim().min(1, 'lastName is required').max(100),
    phone: e164OrEmpty.optional(),
  }),
});

export type CreatePortalBookingBody = z.infer<typeof createPortalBookingSchema>;
