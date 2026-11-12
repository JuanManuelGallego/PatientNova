import { expect, test, type Page } from '@playwright/test';
import { dayPicker, goToTimes } from '../../support/portal';
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

  test('shows the provider, the choice of type and then times, without provider auth calls', async ({ page }) => {
    const authCalls = watchAuthCalls(page);
    await page.goto(`/book/${SLUG}`);

    await expect(page.getByRole('heading', { name: 'Dra. Ana Pública' })).toBeVisible();
    await expect(page.getByText(/Psicóloga/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '¿Qué necesitas?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Control/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Ver horarios' })).toBeDisabled();

    await goToTimes(page, SLUG);
    await expect(page.getByRole('button', { name: /Primer horario disponible/ })).toBeVisible();
    await expect(page.getByText(/Horas en tu zona horaria: Colombia/)).toBeVisible();

    await page.waitForLoadState('networkidle');
    expect(authCalls).toEqual([]);
  });

  test('the profile opens over the booking and closing keeps the choice', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Desktop has the profile open beside the booking.');
    await page.goto(`/book/${SLUG}`);
    await page.getByRole('button', { name: /Control/ }).click();

    await page.getByRole('button', { name: 'Ver perfil' }).click();
    const sheet = page.getByRole('dialog', { name: /Perfil de/ });
    await expect(sheet.getByText(/Consultorio Centro/)).toBeVisible();
    await page.goBack();

    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/book/${SLUG}$`));
    await expect(page.getByRole('button', { name: /Control/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('on desktop the profile is open and the next action ends the reading path', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones keep the sheet and the bottom bar.');
    await page.goto(`/book/${SLUG}`);
    const name = page.getByRole('heading', { level: 1, name: 'Dra. Ana Pública' });
    await expect(name).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver perfil' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Mis citas' })).toHaveCount(0);

    await page.getByRole('button', { name: /Control/ }).click();
    const step = page.getByRole('region', { name: '¿Qué necesitas?' });
    const next = page.getByRole('button', { name: 'Ver horarios' });
    const stepBox = (await step.boundingBox())!;
    const nextBox = (await next.boundingBox())!;
    expect(nextBox.y).toBeGreaterThanOrEqual(stepBox.y + stepBox.height);
    expect(nextBox.x + nextBox.width).toBeGreaterThan(stepBox.x + stepBox.width - 40);
    expect(nextBox.x).toBeGreaterThan((await name.boundingBox())!.x + 320);

    // A step taller than the screen keeps its action in view, and the profile stays beside it.
    await page.setViewportSize({ width: 1280, height: 420 });
    await expect(next).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => window.scrollTo(0, 120));
    await expect(next).toBeInViewport({ ratio: 1 });
    await expect(name).toBeInViewport();

    await next.click();
    await expect(page.getByRole('region', { name: '¿Cuándo te queda bien?' }).getByRole('button', { name: 'Atrás' })).toBeVisible();
  });

  test('the shortcut chooses the first time, and the back button keeps the choice', async ({ page }) => {
    await goToTimes(page, SLUG);
    await page.getByRole('button', { name: /Primer horario disponible/ }).click();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    await page.goBack();
    await expect(page.getByRole('heading', { name: '¿Qué necesitas?' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: '¿Cuándo te queda bien?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('offers the month calendar and never goes before today', async ({ page }, testInfo) => {
    await goToTimes(page, SLUG);
    if (testInfo.project.name === 'public-mobile') {
      await page.getByRole('button', { name: 'Ver calendario' }).click();
      await expect(page.getByRole('dialog', { name: 'Calendario de horarios' })).toBeVisible();
    }
    const previous = page.getByRole('button', { name: 'Mes anterior' });
    await expect(previous).toBeDisabled();
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(previous).toBeDisabled();
  });

  test('holds up at 320px with a long name and four places', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.route(/\/public\/providers\/e2e-publica$/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.displayName = 'Dra. Ana María de los Ángeles Pública Fernández de Soto';
      const place = body.data.locations[ 0 ];
      body.data.locations = [ 1, 2, 3, 4 ].map((n) => ({ ...place, id: `${place.id.slice(0, -1)}${n}`, name: `Consultorio ${n}` }));
      await route.fulfill({ response, json: body });
    });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    await page.goto(`/book/${SLUG}`);
    await page.getByRole('button', { name: /Consultorio 4/ }).click();
    await page.getByRole('button', { name: /Control/ }).click();
    expect(await overflow()).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Ver horarios' }).click();
    await expect(page.getByRole('heading', { name: '¿Cuándo te queda bien?' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver calendario' }).click();
    const sheet = page.getByRole('dialog', { name: 'Calendario de horarios' });
    await expect(sheet).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);

    const box = await dayPicker(sheet.page()).locator('button:not([aria-label^="Mes"])').first().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(38);
    expect(box?.height).toBeGreaterThanOrEqual(44);
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
