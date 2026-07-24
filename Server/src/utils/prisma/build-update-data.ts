/**
 * Builds a Prisma update data object by filtering out undefined values from a DTO.
 * Optional per-field transforms handle null-coercion and value mapping.
 * Returns Record<string, unknown> for Prisma compatibility with exactOptionalPropertyTypes.
 */
export function buildUpdateData<T extends Record<string, unknown>>(
  dto: T,
  fields: (keyof T)[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transforms?: Partial<Record<keyof T, (value: any) => any>>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (dto[field] !== undefined) {
      data[field as string] = transforms?.[field]
        ? transforms[field]!(dto[field])
        : dto[field];
    }
  }
  return data;
}
