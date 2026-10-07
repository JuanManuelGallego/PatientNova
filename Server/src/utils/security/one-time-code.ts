import { createHmac, randomInt } from 'node:crypto';
import { safeEqual } from './safe-equal.js';

/**
 * Primitives for short-lived one-time codes (email OTP for the patient portal).
 * Pure functions only: persistence (hash, attempts, expiry) lives in the caller's table.
 * Codes are never stored: only an HMAC bound to a context (e.g. `${providerId}:${email}`),
 * so a leaked hash cannot be replayed for another provider/email and cannot be brute-forced
 * without the server secret.
 */
export const ONE_TIME_CODE_DEFAULTS = {
  digits: 6,
  ttlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  resendCooldownMs: 60 * 1000,
} as const;

export function generateNumericCode(digits: number = ONE_TIME_CODE_DEFAULTS.digits): string {
  if (!Number.isInteger(digits) || digits < 4 || digits > 10) throw new RangeError('digits must be 4..10');
  return randomInt(0, 10 ** digits).toString().padStart(digits, '0');
}

export function hashOneTimeCode(code: string, context: string, secret: string): string {
  return createHmac('sha256', secret).update(`otp:${context}:${code}`).digest('hex');
}

export function verifyOneTimeCode(code: string, context: string, secret: string, expectedHash: string): boolean {
  return safeEqual(hashOneTimeCode(code, context, secret), expectedHash);
}

export function isCodeExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function areAttemptsExhausted(attempts: number, max: number = ONE_TIME_CODE_DEFAULTS.maxAttempts): boolean {
  return attempts >= max;
}

/** True when enough time has passed since the last send to allow issuing a new code. */
export function canResend(
  lastSentAt: Date,
  now: Date = new Date(),
  cooldownMs: number = ONE_TIME_CODE_DEFAULTS.resendCooldownMs,
): boolean {
  return now.getTime() - lastSentAt.getTime() >= cooldownMs;
}
