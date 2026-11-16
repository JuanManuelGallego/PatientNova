import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const email = process.env.SCREENSHOT_EMAIL || 'admin@patientnova.net';
const password = process.env.SCREENSHOT_PASSWORD;
const outDir = process.env.SCREENSHOT_OUT || join(__dirname, '..', '..', 'src', 'assets', 'screenshots');

const RECORD_PATIENT_ID = '0a7a0001-0000-4000-8000-000000000001';

const RATE_WINDOW_MS = 65_000;

interface Shot {
  name: string;
  path: string;
  area?: { content: number } | { selector: string };
  prepare?: (page: Page) => Promise<void>;
}

const CONTENT_X = 260;

const SHOTS: Shot[] = [
  { name: 'calendar', path: '/calendar' },
  { name: 'requests', path: '/requests', area: { content: 600 } },
  { name: 'booking-availability', path: '/settings/booking', area: { selector: '#online-booking-availability' } },
  {
    name: 'reminders',
    path: '/reminders',
    area: { content: 900 },
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Historial', exact: true }).click();
      await page.waitForLoadState('networkidle');
    },
  },
  { name: 'medical-record', path: `/medical-records?patientId=${RECORD_PATIENT_ID}`, area: { content: 900 } },
];

async function login(page: Page) {
  if (!password) throw new Error('Set SCREENSHOT_PASSWORD (or put it in e2e/.env.screenshots): the local password of the seeded account.');
  await page.addInitScript(() => {
    try { localStorage.setItem('patientnova-theme', 'light'); } catch { /* private mode */ }
  });
  await page.goto('/login');
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-submit-button').click();
  await page.waitForURL(/\/dashboard/);
}

async function open(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.waitForTimeout(RATE_WINDOW_MS);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) throw new Error(`Logged out while opening ${path}`);
    const limited = await page.getByText('Demasiadas solicitudes').count();
    if (!limited) return;
  }
  throw new Error(`Rate limited on ${path}; wait a minute and run again.`);
}

async function clean(page: Page) {
  await page.locator('.sidebar-user__name').waitFor({ state: 'visible', timeout: 15_000 });
  await page.addStyleTag({
    content: `
      nextjs-portal, .warning-banner { display: none !important; }
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll('.sidebar-user__avatar').forEach((el) => {
      const name = document.querySelector('.sidebar-user__name')?.textContent ?? '';
      el.textContent = name.split(/\s+/).filter((w) => w && !w.endsWith('.')).slice(0, 2).map((w) => w[ 0 ]).join('');
    });
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

test('marketing screenshots', async ({ page }) => {
  test.setTimeout(SHOTS.length * 3 * RATE_WINDOW_MS);
  mkdirSync(outDir, { recursive: true });
  await login(page);
  const only = process.env.SCREENSHOT_ONLY?.split(',').map((n) => n.trim());
  for (const shot of SHOTS.filter((s) => !only || only.includes(s.name))) {
    await open(page, shot.path);
    await shot.prepare?.(page);
    await clean(page);
    const path = join(outDir, `${shot.name}.png`);
    const area = shot.area;
    if (area && 'selector' in area) {
      await page.locator(area.selector).screenshot({ path });
    } else {
      const clip = area
        ? { x: CONTENT_X, y: 0, width: 1440 - CONTENT_X, height: area.content }
        : { x: 0, y: 0, width: 1440, height: 900 };
      await page.screenshot({ path, clip });
    }
  }
});
