import type { Prisma } from '../../../generated/prisma/client.ts';
import { emailHash, looksLikePhone, nameQueryTokens, phoneHash } from './blind-index.js';

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

export function medicalRecordNameWhere(search: string): Prisma.MedicalRecordWhereInput | null {
  const tokens = nameQueryTokens(search);
  if (tokens.length === 0) return null;
  return { AND: tokens.map((token) => ({ nameTokens: { has: token } })) };
}

export const MATCH_NOTHING = { id: { in: [] as string[] } };
