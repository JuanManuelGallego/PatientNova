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
export const PII_VERSION = 2; // 2: name tokens include 3+ letter prefixes

/** Shortest prefix indexed for name search; shorter query words only match whole words. */
export const MIN_PREFIX_LENGTH = 3;
// Bounds the tokens per word (and what a long word reveals); longer query words are truncated.
const MAX_PREFIX_LENGTH = 20;

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

/**
 * Stored name tokens: for every word, the hash of the whole word plus the hashes of its prefixes
 * of 3 to 20 letters ("maria" -> mar, mari, maria). Case- and accent-insensitive.
 */
export function nameTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  const tokens = new Set<string>();
  for (const word of nameWords(value)) {
    const letters = Array.from(word);
    tokens.add(hmac('name', word));
    const longest = Math.min(letters.length, MAX_PREFIX_LENGTH);
    for (let n = MIN_PREFIX_LENGTH; n <= longest; n++) tokens.add(hmac('name', letters.slice(0, n).join('')));
  }
  return [ ...tokens ];
}

/**
 * Query tokens, one per search word: a word of 3+ letters matches any name word starting with it,
 * a shorter one only an identical whole word ("jo" does not find "José", "de" finds "de").
 */
export function nameQueryTokens(text: string): string[] {
  return [ ...new Set(nameWords(text).map((w) => hmac('name', Array.from(w).slice(0, MAX_PREFIX_LENGTH).join('')))) ];
}

/** True when the search text looks like a phone number (only digits and phone punctuation). */
export function looksLikePhone(text: string): boolean {
  return /^[+\d\s().-]+$/.test(text) && normalizePhone(text).length >= 5;
}
