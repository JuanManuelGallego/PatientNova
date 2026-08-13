import { defineConfig, devices } from '@playwright/test';
import { Env } from './utils/env';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 8,
  reporter: [ [ 'list' ], [ 'html' ] ],

  use: {
    baseURL: Env.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 15 * 1000,
    locale: 'en-US',
    extraHTTPHeaders:
    {
      'x-vercel-protection-bypass': Env.vercelAutomationBypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    },
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/, testDir: '.' },

    {
      name: 'chromium',
      use: {
        ...devices[ 'Desktop Chrome' ],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: [ 'setup' ],
    },
  ],

  expect: {
    timeout: 10_000,
  }
});
