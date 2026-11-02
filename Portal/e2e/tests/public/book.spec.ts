import { expect, test, type Page } from '@playwright/test';
import { Env } from '../../utils/env';

const SLUG = 'e2e-publica';

function watchAuthCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on('request', (req) => {
    if (/\/v1\/(users\/me|auth\/)/.test(req.url())) calls.push(req.url());
  });
  return calls;
}

test.describe('public booking page', () => {
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
    await expect(page.getByRole('group', { name: 'Días de la semana' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Tarde' }).getByRole('button').first()).toBeVisible();
    await expect(page.getByText(/Horas en tu zona horaria: Colombia/)).toBeVisible();

    await page.waitForLoadState('networkidle');
    expect(authCalls).toEqual([]);
  });

  test('switching the type reloads the slots for it', async ({ page }) => {
    await page.goto(`/book/${SLUG}`);
    await expect(page.getByRole('group', { name: 'Días de la semana' })).toBeVisible();

    const reload = page.waitForRequest((req) => req.url().includes('/slots?') && req.url().includes('00000000-0000-4000-8000-0000000000b1'));
    await page.getByRole('button', { name: /Primera consulta/ }).click();
    await reload;
    await expect(page.getByRole('button', { name: /Primera consulta/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Días de la semana' })).toBeVisible();
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
