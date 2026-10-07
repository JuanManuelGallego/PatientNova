/**
 * Resolves the runtime environment, FAILING CLOSED: when NODE_ENV is unset or blank we behave as
 * production. Security shortcuts (e.g. skipping webhook signature checks) are only available when
 * NODE_ENV is explicitly set to "development".
 */
export function resolveNodeEnv(raw: string | undefined): string {
  const value = raw?.trim();
  return value ? value : 'production';
}
