import { expect, test } from '@playwright/test';

// The mobile project reuses the authenticated state, so start from a clean context for the login form.
test.use({ storageState: { cookies: [], origins: [] } });

test('login form fits a phone viewport', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId('login-email-input')).toBeVisible();
  await expect(page.getByTestId('login-submit-button')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
