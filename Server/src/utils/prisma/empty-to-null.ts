/**
 * Maps empty strings (and null/undefined) to `null`.
 *
 * Repository update transforms use this so an explicit empty string from a
 * client clears a nullable text field instead of persisting a literal "".
 * Non-empty/non-string values pass through unchanged.
 */
export function emptyToNull<T>(value: T): T | null {
  return value === "" || value === null || value === undefined ? null : (value as T | null);
}
