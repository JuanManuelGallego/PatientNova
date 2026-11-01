import { expect, test, type Page } from '@playwright/test';
import { Env } from '../../utils/env';

// Seeded by Server `db:seed-e2e` (seedPublicProvider): booking live, open 08:00-18:00 every day,
// types "Control" (30 min, listed first by name) and "Primera consulta" (60 min), one in-person location.
const SLUG = 'e2e-publica';

/** Collects any request to the provider auth API; the public page must never make one. */
function watchAuthCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (req) => {
    if (/\/v1\/(users\/me|auth\/)/.test(req.url())) calls.push(req.url());
  });
  return calls;
}

test.describe('public booking page', () => {
  // The Vercel bypass headers (config `extraHTTPHeaders`, deployed previews) are meant for the Portal only:
  // on the page's own API calls they trigger a CORS preflight the anonymous API rightly refuses.
  test.beforeEach(async ({ page }) => {
    await page.route(`${new URL(Env.apiBaseUrl).origin}/**`, (route) => {
      const headers = { ...route.request().headers() };
      delete headers[ 'x-vercel-protection-bypass' ];
      delete headers[ 'x-vercel-set-bypass-cookie' ];
      return route.continue({ headers });
    });
  });

  test('shows the provider card, types, location and slots without provider auth calls', async ({ page }) => {
    const authCalls = watchAuthCalls(page);
    await page.goto(`/book/${SLUG}`);

    await expect(page.getByRole('heading', { name: 'Dra. Ana Pública' })).toBeVisible();
    await expect(page.getByText('Psicóloga')).toBeVisible();
    await expect(page.getByRole('button', { name: /Control/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Consultorio Centro/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Días con horarios' }).getByRole('button').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reservar' })).toBeDisabled();
    await expect(page.getByText(/Horario de Colombia/)).toBeVisible();

    await page.waitForLoadState('networkidle');
    expect(authCalls).toEqual([]);
  });

  test('switching the type reloads the slots for it', async ({ page }) => {
    await page.goto(`/book/${SLUG}`);
    await expect(page.getByRole('group', { name: 'Días con horarios' })).toBeVisible();

    const reload = page.waitForRequest((req) => req.url().includes('/slots?') && req.url().includes('00000000-0000-4000-8000-0000000000b1'));
    await page.getByRole('button', { name: /Primera consulta/ }).click();
    await reload;
    await expect(page.getByRole('button', { name: /Primera consulta/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Días con horarios' })).toBeVisible();
  });

  test('pages forward a week and back, never before today', async ({ page }) => {
    await page.goto(`/book/${SLUG}`);
    const previous = page.getByRole('button', { name: 'Semana anterior' });
    await expect(previous).toBeDisabled();
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(previous).toBeDisabled();
  });

  test('an unknown slug shows the unavailable page', async ({ page }) => {
    const authCalls = watchAuthCalls(page);
    await page.goto('/book/no-existe-este-enlace');
    await expect(page.getByRole('heading', { name: 'Esta página de reservas no está disponible' })).toBeVisible();
    expect(authCalls).toEqual([]);
  });

  test('has no horizontal scroll at the current viewport', async ({ page }) => {
    await page.goto(`/book/${SLUG}`);
    await expect(page.getByRole('heading', { name: 'Dra. Ana Pública' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('is not indexed by search engines', async ({ page }) => {
    await page.goto(`/book/${SLUG}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
