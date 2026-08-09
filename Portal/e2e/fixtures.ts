import { test as base } from '@playwright/test';
import { ApiClient, createApiClient } from './utils/api';

type TestFixtures = {
  api: ApiClient;
};

export const test = base.extend<TestFixtures>({
  api: async ({ page }, use) => {
    const api = createApiClient(page);
    await use(api);
  },
});

export { expect } from '@playwright/test';
