/**
 * Returns true if the error is a Prisma unique-constraint violation (P2002).
 */
export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>).code === 'P2002'
  );
}

/** Name of the raw-SQL exclusion constraint that forbids overlapping active appointments per provider. */
export const APPOINTMENT_OVERLAP_CONSTRAINT = 'appointments_no_provider_overlap';

/**
 * True when Postgres rejected a write with an exclusion violation (SQLSTATE 23P01) on the
 * appointment overlap constraint. Prisma surfaces it as PrismaClientKnownRequestError P2039
 * with the driver error under `meta.driverAdapterError.cause`.
 */
export function isAppointmentOverlapViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const meta = (err as { meta?: { driverAdapterError?: { cause?: Record<string, unknown> } } }).meta;
  const cause = meta?.driverAdapterError?.cause;
  if (!cause || cause.originalCode !== '23P01') return false;
  return String(cause.originalMessage ?? '').includes(APPOINTMENT_OVERLAP_CONSTRAINT);
}
