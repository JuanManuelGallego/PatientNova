import { z } from 'zod';

/** Inbox tabs over the effective status: a PENDING row past `holdExpiresAt` counts as expired. */
export const BOOKING_REQUEST_TABS = [ 'pending', 'resolved', 'expired' ] as const;
export type BookingRequestTab = typeof BOOKING_REQUEST_TABS[number];

export const listBookingRequestsQuerySchema = z.strictObject({
  status: z.enum(BOOKING_REQUEST_TABS).default('pending'),
  /** Requested start inside [from, to); the calendar uses it for the visible range. */
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine(
  (q) => !q.from || !q.to || new Date(q.from) < new Date(q.to),
  { message: 'from must be before to', path: [ 'to' ] },
);

/**
 * Approve: without `restorePatientId` the request reuses the email's active patient (reactivating an inactive one) or
 * creates a new one. `restorePatientId` restores one of the email's deleted patients instead.
 */
export const approveBookingRequestSchema = z.strictObject({
  restorePatientId: z.uuid().optional(),
}).optional();

export const rejectBookingRequestSchema = z.strictObject({}).optional();

export type ListBookingRequestsQuery = z.infer<typeof listBookingRequestsQuerySchema>;
export type ApproveBookingRequestBody = z.infer<typeof approveBookingRequestSchema>;
