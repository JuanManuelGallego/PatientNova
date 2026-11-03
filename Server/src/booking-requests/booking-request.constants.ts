const HOUR_MS = 3_600_000;

/** How long a pending request holds its slot, at most. */
export const HOLD_HOURS = 48;
/** Age at which the provider is nudged about a still-pending request (6.5). */
export const NUDGE_HOURS = 24;
export const MAX_PENDING_REQUESTS_PER_EMAIL = 3;
export const MAX_PENDING_REQUESTS_PER_PROVIDER = 50;

/** A hold lasts 48h but never past the start of the requested slot. */
export function holdExpiry(now: Date, startAt: Date): Date {
  return new Date(Math.min(now.getTime() + HOLD_HOURS * HOUR_MS, startAt.getTime()));
}
