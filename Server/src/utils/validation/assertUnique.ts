/**
 * Checks for an existing record and throws the provided error class if found.
 */
export async function assertUnique(
  finder: () => Promise<unknown>,
  ErrorClass: new (identifier: string) => Error,
  identifier: string,
): Promise<void> {
  const existing = await finder();
  if (existing) throw new ErrorClass(identifier);
}
