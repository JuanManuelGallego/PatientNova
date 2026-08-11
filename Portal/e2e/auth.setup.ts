import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { Env } from './utils/env';
import { LoginPage } from './pages/LoginPage';
import { Routes } from './utils/const';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  mkdirSync(dirname(authFile), { recursive: true });

  const loginPage = new LoginPage(page);
  await loginPage.login(Env.testUserEmail, Env.testUserPassword);

  await page.waitForURL(/\/dashboard/)

  await page.context().storageState({ path: authFile });
});
