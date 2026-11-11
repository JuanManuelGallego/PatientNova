import { ONE_HOUR_MS, ONE_MINUTE_MS } from '../utils/config/constants.js';

export const HOLD_HOURS = 48;
/** The provider gets one reminder about a pending request once half its hold has passed (24h for a full 48h hold). */
export const NUDGE_HOURS = 24;
/** Resolved requests stay in the inbox history this long, then the daily purge deletes them. */
export const RESOLVED_RETENTION_DAYS = 90;
export const MAX_PENDING_REQUESTS_PER_CONTACT = 3;
export const MAX_PENDING_REQUESTS_PER_PROVIDER = 50;

export function holdExpiry(now: Date, startAt: Date): Date {
  return new Date(Math.min(now.getTime() + HOLD_HOURS * ONE_HOUR_MS, startAt.getTime()));
}

/** Nudge once the hold is half over; a full 48h hold is nudged 24h before it expires. */
export function isNudgeDue(createdAt: Date, holdExpiresAt: Date, now: Date): boolean {
  const half = createdAt.getTime() + (holdExpiresAt.getTime() - createdAt.getTime()) / 2;
  return now.getTime() >= half;
}

export const UNCONFIRMED_HOLD_MINUTES = 15;
export const MAX_UNCONFIRMED_PER_PROVIDER = 5;
export const EMAIL_SENDS_PER_HOUR = 5;
export const UNCONFIRMED_RETENTION_HOURS = 48;

export function unconfirmedHoldExpiry(now: Date, startAt: Date): Date {
  return new Date(Math.min(now.getTime() + UNCONFIRMED_HOLD_MINUTES * ONE_MINUTE_MS, startAt.getTime()));
}
