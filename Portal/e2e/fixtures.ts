import { test as base, Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { createApiClient } from './utils/api';
import { Env } from './utils/env';

type Fixtures = {
  authenticatedPage: Page;
  api: ReturnType<typeof createApiClient>;
  seededIds: { [resource: string]: string[] };
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

  api: async ({ authenticatedPage }, use) => {
    const api = createApiClient(authenticatedPage);
    await use(api);
  },

  seededIds: async ({}, use) => {
    const ids: { [resource: string]: string[] } = {};
    await use(ids);
  },
});

export { expect } from '@playwright/test';
