import { defineConfig, devices } from '@playwright/test';
import { Env } from './utils/env';

const authState = 'e2e/.auth/user.json';

// The seeded provider's timezone: the Server's `config.defaults.timezone` constant (keep the two equal). The browser and the test runner both use it, so wall-clock times picked in the UI, computed
// in specs and rendered by the calendar agree. The Next server is not affected (in CI it runs in UTC).
// Set before workers spawn so they inherit it.
const E2E_TIMEZONE = 'America/Bogota';
process.env.TZ = E2E_TIMEZONE;
const publicSpecs = /tests\/public\/.*\.spec\.ts/;
const mobileSpecs = /tests\/mobile\/.*\.spec\.ts/;
const pwaSpecs = /tests\/pwa\/.*\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  testMatch: '**/*.spec.ts',
  // One provider (the seeded test user) has ONE calendar: the API rejects overlapping appointments,
  // and many specs create appointments at the same relative times. Running spec files in parallel
  // therefore produces false 409s, so the suite runs serially against the shared account.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [ [ 'list' ], [ 'html' ] ],

  use: {
    baseURL: Env.baseUrl,
    // A worker would cache chunks and answer navigations behind Playwright's back; only the `pwa` project opts in.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 15 * 1000,
    locale: 'en-US',
    timezoneId: E2E_TIMEZONE,
    // Only needed when testing a Vercel deployment that has protection enabled.
    ...(Env.vercelAutomationBypassSecret && {
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': Env.vercelAutomationBypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      },
    }),
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/, testDir: '.' },

    // Authenticated provider dashboard, desktop.
    {
      name: 'chromium',
      testIgnore: [ publicSpecs, mobileSpecs, pwaSpecs ],
      use: { ...devices[ 'Desktop Chrome' ], storageState: authState },
      dependencies: [ 'setup' ],
    },

    // Authenticated provider dashboard, phone viewport (mobile-specific specs only).
    {
      name: 'mobile',
      testMatch: mobileSpecs,
      use: { ...devices[ 'Pixel 7' ], storageState: authState },
      dependencies: [ 'setup' ],
    },

    // Installability: manifest, worker scope, caches and the offline page. Needs a production build (the worker registers only there).
    {
      name: 'pwa',
      testMatch: pwaSpecs,
      use: { ...devices[ 'Desktop Chrome' ], storageState: authState, serviceWorkers: 'allow' },
      dependencies: [ 'setup' ],
    },

    // No session at all: public/patient-facing pages. Runs without the auth setup.
    {
      name: 'public',
      testMatch: publicSpecs,
      use: { ...devices[ 'Desktop Chrome' ] },
    },
    {
      name: 'public-mobile',
      testMatch: publicSpecs,
      use: { ...devices[ 'Pixel 7' ] },
    },
  ],

  expect: {
    timeout: 10_000,
  }
});
