import { test as base, Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { Env } from './utils/env';

type Fixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    const context = page.context();
    await context.clearCookies();
    await context.clearPermissions();

    const loginPage = new LoginPage(page);
    await loginPage.login(Env.testUserEmail, Env.testUserPassword);

    await use(page);
  },
});

export { expect } from '@playwright/test';
