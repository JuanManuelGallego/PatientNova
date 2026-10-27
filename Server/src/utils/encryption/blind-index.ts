import { createHmac } from 'node:crypto';
import { config } from '../config/config.js';
import { normalizeEmail } from '../validation/normalize-email.js';

export const PII_VERSION = 2;
export const MIN_PREFIX_LENGTH = 3;
const MAX_PREFIX_LENGTH = 20;

type Purpose = 'email' | 'phone' | 'name' | 'portal-actor';

function keyBuffer(): Buffer {
  const key = config.encryption.blindIndexKey;
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error('BLIND_INDEX_KEY must be a 64-character hex string (256 bits)');
  return Buffer.from(key, 'hex');
}

function hmac(purpose: Purpose, value: string): string {
  return createHmac('sha256', keyBuffer()).update(`${purpose}:${value}`).digest('hex');
}

export function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/i, '').replace(/\D/g, '');
}

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

export function portalActorHash(userId: string, email: string): string {
  return hmac('portal-actor', `${userId}:${normalizeEmail(email)}`);
}

export function phoneHash(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = normalizePhone(phone);
  return digits ? hmac('phone', digits) : null;
}

export function contactHash(destination: string | null | undefined): string | null {
  if (!destination) return null;
  return destination.includes('@') ? emailHash(destination) : phoneHash(destination);
}

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

export function nameQueryTokens(text: string): string[] {
  return [ ...new Set(nameWords(text).map((w) => hmac('name', Array.from(w).slice(0, MAX_PREFIX_LENGTH).join('')))) ];
}

export function looksLikePhone(text: string): boolean {
  return /^[+\d\s().-]+$/.test(text) && normalizePhone(text).length >= 5;
}
