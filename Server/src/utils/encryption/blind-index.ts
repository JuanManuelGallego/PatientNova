import { createHmac } from 'node:crypto';
import { config } from '../config/config.js';
import { normalizeEmail } from '../validation/normalize-email.js';

/**
 * Blind indexes: keyed hashes (HMAC-SHA256 with BLIND_INDEX_KEY) of normalized PII, stored next
 * to the encrypted value so we can match and search without decrypting. Each hash is bound to a
 * purpose (`email`, `phone`, `name`), so equal strings in different kinds of fields do not
 * produce equal hashes. Phone and email hashes are shared across models on purpose: a reminder's
 * `toHash` equals the patient's `whatsappHash` for the same number.
 *
 * Bump PII_VERSION when the key or a normalization rule changes, then run `pii:backfill`.
 */
export const PII_VERSION = 1;

type Purpose = 'email' | 'phone' | 'name';

function keyBuffer(): Buffer {
  const key = config.encryption.blindIndexKey;
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error('BLIND_INDEX_KEY must be a 64-character hex string (256 bits)');
  return Buffer.from(key, 'hex');
}

function hmac(purpose: Purpose, value: string): string {
  return createHmac('sha256', keyBuffer()).update(`${purpose}:${value}`).digest('hex');
}

/** Digits only (drops `whatsapp:`, `+`, spaces, dashes, parentheses). */
export function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/i, '').replace(/\D/g, '');
}

/** Lower-case, accents removed, anything that is not a letter or digit becomes a separator. */
export function nameWords(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function emailHash(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  return normalized ? hmac('email', normalized) : null;
}

export function phoneHash(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = normalizePhone(phone);
  return digits ? hmac('phone', digits) : null;
}

/** A message destination is an email when it contains `@`, otherwise a phone number. */
export function contactHash(destination: string | null | undefined): string | null {
  if (!destination) return null;
  return destination.includes('@') ? emailHash(destination) : phoneHash(destination);
}

/** Distinct word hashes of a name, for whole-word, case- and accent-insensitive search. */
export function nameTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return [ ...new Set(nameWords(value).map((w) => hmac('name', w))) ];
}

/** True when the search text looks like a phone number (only digits and phone punctuation). */
export function looksLikePhone(text: string): boolean {
  return /^[+\d\s().-]+$/.test(text) && normalizePhone(text).length >= 5;
}
