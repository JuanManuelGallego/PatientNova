export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

// Lowercase letters, digits and single hyphens; no leading/trailing hyphen.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'api', 'app', 'appointments', 'auth', 'book', 'booking', 'calendar', 'dashboard',
  'help', 'login', 'logout', 'me', 'new', 'patients', 'portal', 'privacy', 'public', 'register',
  'requests', 'reset-password', 'settings', 'signup', 'static', 'support', 'terms', 'v1', 'www',
]);

export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
}

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export async function suggestSlug(base: string, isTaken: (slug: string) => Promise<boolean>, maxAttempts = 50): Promise<string | null> {
  let root = normalizeSlug(base);
  if (root.length < SLUG_MIN_LENGTH) root = normalizeSlug(`consulta-${root}`);
  for (let n = 1; n <= maxAttempts; n++) {
    const suffix = n === 1 ? '' : `-${n}`;
    const candidate = `${root.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!isValidSlugFormat(candidate) || isReservedSlug(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  return null;
}
