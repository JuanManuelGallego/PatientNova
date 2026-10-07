/**
 * Canonical form of an email for storage and comparison: trimmed and lower-cased.
 * The email blind index (`emailHash`, see blind-index.ts) hashes this same form, so storage,
 * uniqueness and lookups all agree.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
