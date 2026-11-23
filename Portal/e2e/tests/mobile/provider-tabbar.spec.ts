import { request as playwrightRequest } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { createTestPatient, createTestAppointment } from '../../utils/helpers';
import { Env } from '../../utils/env';

const tabBar = (page: Page) => page.getByTestId('bottom-tabbar');
const tab = (page: Page, id: string) => page.getByTestId(`tabbar-link-${id}`);

async function expectActive(page: Page, id: string) {
  await expect(tab(page, id)).toHaveAttribute('aria-current', 'page');
  await expect(tabBar(page).locator('[aria-current="page"]')).toHaveCount(1);
}

test.describe('Bottom tab bar (phone)', () => {
  test('shows the daily screens, Recordatorios last and none active on the dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(tabBar(page)).toBeVisible();
    for (const [ id, label ] of [ [ 'calendar', 'Calendario' ], [ 'appointments', 'Citas' ], [ 'patients', 'Pacientes' ], [ 'reminders', 'Recordatorios' ] ]) {
      await expect(tab(page, id)).toHaveText(label);
    }
    await expect(tabBar(page).getByRole('link').last()).toHaveAttribute('data-testid', 'tabbar-link-reminders');
    await expect(tab(page, 'dashboard')).toHaveCount(0);
    await expect(tabBar(page).locator('[aria-current="page"]')).toHaveCount(0);
    await expect(page.getByTestId('hamburger-button')).toBeVisible();

    const box = await tab(page, 'patients').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const label = tab(page, 'reminders').locator('.bottom-tabbar__label');
    expect(await label.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('navigates between tabs, the active tab following the route and Back', async ({ page }) => {
    await page.goto('/dashboard');

    await tab(page, 'appointments').click();
    await expect(page).toHaveURL(/\/appointments(\?|$)/);
    await expectActive(page, 'appointments');

    await tab(page, 'patients').click();
    await expect(page).toHaveURL(/\/patients(\?|$)/);
    await expectActive(page, 'patients');

    await page.goBack();
    await expect(page).toHaveURL(/\/appointments(\?|$)/);
    await expectActive(page, 'appointments');

    await page.goto('/calendar');
    await expectActive(page, 'calendar');

    await tab(page, 'reminders').click();
    await expect(page).toHaveURL(/\/reminders(\?|$)/);
    await expectActive(page, 'reminders');
  });

  test('sits under the open menu', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('hamburger-button').click();
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible();

    const bar = await tabBar(page).boundingBox();
    await page.mouse.click(bar!.x + bar!.width - 20, bar!.y + bar!.height / 2);
    await expect(page.getByTestId('sidebar-backdrop')).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard(\?|$)/);
  });

  test('never covers the last card on Citas', async ({ page, api, trackedPatients, trackedAppointments }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    for (let i = 0; i < 6; i++) {
      const appointment = await createTestAppointment(api, patient.id);
      trackedAppointments.track(appointment.data.id);
    }

    await page.goto(`/appointments?patientId=${patient.id}`);
    const cards = page.locator('[data-testid^="appointment-card-"]');
    await expect(cards).toHaveCount(6);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = cards.last();
    await expect(last).toBeInViewport();
    const card = (await last.boundingBox())!;
    const bar = (await tabBar(page).boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(bar.y);
  });
});

test('serves the web app manifest and its icons without a session', async () => {
  const anonymous = await playwrightRequest.newContext({
    baseURL: Env.baseUrl,
    ...(Env.vercelAutomationBypassSecret && {
      extraHTTPHeaders: { 'x-vercel-protection-bypass': Env.vercelAutomationBypassSecret },
    }),
  });
  try {
    const response = await anonymous.get('/app.webmanifest', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()[ 'content-type' ]).toContain('application/manifest+json');
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: 'Patient Nova', start_url: '/dashboard', display: 'standalone' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining([ '192x192', '512x512' ]));

    for (const icon of manifest.icons as { src: string }[]) {
      const image = await anonymous.get(icon.src, { maxRedirects: 0 });
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()[ 'content-type' ]).toBe('image/png');
    }
  } finally {
    await anonymous.dispose();
  }
});

test('links the manifest from provider pages only, never from public ones', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/app.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);

  await page.goto('/privacy-policy');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});
