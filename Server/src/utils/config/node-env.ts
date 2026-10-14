export function resolveNodeEnv(raw: string | undefined): string {
  const value = raw?.trim();
  return value ? value : 'production';
}
