/**
 * Canonical form of an email for storage and comparison: trimmed and lower-cased.
 * The patients unique index is built on the same expression (lower(btrim("email"))),
 * so every write path and lookup must go through this function.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
