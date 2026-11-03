export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>).code === 'P2002'
  );
}

export const APPOINTMENT_OVERLAP_CONSTRAINT = 'appointments_no_provider_overlap';

export const BOOKING_HOLD_OVERLAP_CONSTRAINT = 'booking_requests_no_hold_overlap';

/** The exclusion backstop for appointments or for pending booking-request holds (both map to a neutral 409). */
export function isAppointmentOverlapViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const meta = (err as { meta?: { driverAdapterError?: { cause?: Record<string, unknown> } } }).meta;
  const cause = meta?.driverAdapterError?.cause;
  if (!cause || cause.originalCode !== '23P01') return false;
  const message = String(cause.originalMessage ?? '');
  return message.includes(APPOINTMENT_OVERLAP_CONSTRAINT) || message.includes(BOOKING_HOLD_OVERLAP_CONSTRAINT);
}
