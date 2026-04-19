/**
 * Returns true if the error is a Prisma unique-constraint violation (P2002).
 */
export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>).code === 'P2002'
  );
}
