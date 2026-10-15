import { expect, test } from '@playwright/test';
import { Env } from '../../utils/env';

// Public pages must work for anonymous visitors without ever touching the provider auth API.
const PUBLIC_PATHS = [ '/privacy-policy', '/terms-of-service' ];

for (const path of PUBLIC_PATHS) {
  test.describe(`public page ${path}`, () => {
    test('renders without provider auth calls (/users/me, /auth/refresh)', async ({ page }) => {
      const apiCalls: string[] = [];
      page.on('request', (req) => {
        const url = req.url();
        if (Env.apiBaseUrl && url.startsWith(Env.apiBaseUrl)) apiCalls.push(url);
        if (/\/(users\/me|auth\/refresh)/.test(url)) apiCalls.push(url);
      });

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('networkidle');

      expect(apiCalls).toEqual([]);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('has no horizontal scroll at the current viewport', async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('sends the hardening headers', async ({ page }) => {
      const response = await page.goto(path);
      const headers = response!.headers();
      expect(headers[ 'x-content-type-options' ]).toBe('nosniff');
      expect(headers[ 'x-frame-options' ]).toBe('DENY');
      expect(headers[ 'referrer-policy' ]).toBe('strict-origin-when-cross-origin');
      expect(headers[ 'content-security-policy' ] ?? headers[ 'content-security-policy-report-only' ]).toContain("frame-ancestors 'none'");
    });
  });
}
