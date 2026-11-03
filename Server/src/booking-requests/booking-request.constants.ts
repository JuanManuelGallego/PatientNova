const HOUR_MS = 3_600_000;

export const HOLD_HOURS = 48;
export const NUDGE_HOURS = 24;
export const MAX_PENDING_REQUESTS_PER_EMAIL = 3;
export const MAX_PENDING_REQUESTS_PER_PROVIDER = 50;

export function holdExpiry(now: Date, startAt: Date): Date {
  return new Date(Math.min(now.getTime() + HOLD_HOURS * HOUR_MS, startAt.getTime()));
}
