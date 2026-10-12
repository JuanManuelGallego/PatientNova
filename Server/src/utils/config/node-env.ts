/**
 * Resolves the runtime environment, FAILING CLOSED: when NODE_ENV is unset or blank we behave as
 * production (e.g. ENCRYPTION_KEY becomes required).
 */
export function resolveNodeEnv(raw: string | undefined): string {
  const value = raw?.trim();
  return value ? value : 'production';
}
