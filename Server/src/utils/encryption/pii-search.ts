import type { Prisma } from '../../../generated/prisma/client.ts';
import { emailHash, looksLikePhone, nameQueryTokens, phoneHash } from './blind-index.js';

/**
 * Search filters over encrypted patient PII, built on blind indexes (see blind-index.ts):
 *   - text with `@`      -> exact email (case/whitespace-insensitive)
 *   - phone-like text    -> exact phone number (punctuation ignored)
 *   - anything else      -> every word must start a word of the name or last name (3+ letters),
 *                           or equal one (shorter words); case- and accent-insensitive.
 * Returns null when the text has nothing searchable, so callers can return no results.
 */
export function patientSearchWhere(search: string): Prisma.PatientWhereInput | null {
  const text = search.trim();
  if (!text) return null;

  if (text.includes('@')) {
    const hash = emailHash(text);
    return hash ? { emailHash: hash } : null;
  }
  if (looksLikePhone(text)) {
    const hash = phoneHash(text);
    return hash ? { OR: [ { whatsappHash: hash }, { smsHash: hash } ] } : null;
  }

  const tokens = nameQueryTokens(text);
  if (tokens.length === 0) return null;
  return {
    AND: tokens.map((token) => ({
      OR: [ { nameTokens: { has: token } }, { lastNameTokens: { has: token } } ],
    })),
  };
}

/** Name search (same prefix rules) for the medical record's own (encrypted) name field. */
export function medicalRecordNameWhere(search: string): Prisma.MedicalRecordWhereInput | null {
  const tokens = nameQueryTokens(search);
  if (tokens.length === 0) return null;
  return { AND: tokens.map((token) => ({ nameTokens: { has: token } })) };
}

/** Matches nothing; used when a search has no searchable content. */
export const MATCH_NOTHING = { id: { in: [] as string[] } };
