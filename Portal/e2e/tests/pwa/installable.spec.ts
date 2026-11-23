import { test, expect, type Page } from '@playwright/test';

const SLUG = 'e2e-publica';

/** Waits until the page is controlled by the worker (registration, activation and a reload). */
async function controlled(page: Page) {
  await page.goto('/dashboard');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.describe('installable provider app', () => {
  test('serves the manifest and its icons', async ({ request }) => {
    const res = await request.get('/app.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/manifest+json');
    const manifest = await res.json();
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons as { src: string }[]) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.status(), icon.src).toBe(200);
      expect(iconRes.headers()['content-type']).toContain('image/png');
    }
  });

  test('registers the worker on the dashboard with no-store headers', async ({ page, request, baseURL }) => {
    await page.goto('/dashboard');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe(`${baseURL}/`);
    const res = await request.get('/sw.js');
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  test('caches only static assets and the offline page', async ({ page }) => {
    await controlled(page);
    await page.goto('/patients');
    const urls = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) out.push(req.url);
      }
      return out;
    });
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const { pathname } = new URL(url);
      expect(pathname === '/offline.html' || pathname.startsWith('/_next/static/'), url).toBe(true);
    }
  });

  test('shows Sin conexión when a provider page cannot reach the network', async ({ page, context }) => {
    await controlled(page);
    // Chromium applies route aborts to the worker's own fetches, which setOffline may not reach.
    await context.route('**/patients**', (route) => route.abort('internetdisconnected'));
    await page.goto('/patients').catch(() => undefined);
    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
  });

  test('registers nothing on the booking page or the landing page', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    try {
      const page = await context.newPage();
      for (const path of [ `/book/${SLUG}`, '/' ]) {
        await page.goto(path);
        const count = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
        expect(count, path).toBe(0);
      }
    } finally {
      await context.close();
    }
  });
});
