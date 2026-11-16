import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig, devices } from '@playwright/test';

/*
 * Captures the product screenshots shown on the marketing pages (src/assets/screenshots/).
 * Not part of the e2e suite: run it by hand against a local stack seeded with made-up data.
 *
 *   cd Server && pnpm run db:seed-data      # made-up patients, records, appointments, requests
 *   cd Portal && pnpm run screenshots
 *
 * The login comes from the environment or from the gitignored `e2e/.env.screenshots`:
 *   SCREENSHOT_EMAIL=admin@patientnova.net   (the account db:seed-data fills; the default)
 *   SCREENSHOT_PASSWORD=...                  (that account's local password)
 *
 * Never point it at production or real patients: these images are published.
 */
// Read literally (KEY=VALUE per line, optional surrounding quotes): `process.loadEnvFile` would cut an
// unquoted value at `#`, which passwords often contain.
const envFile = join(__dirname, '.env.screenshots');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(SCREENSHOT_[A-Z_]+)\s*=(.*)$/.exec(line);
    if (match && process.env[ match[ 1 ] ] === undefined) {
      process.env[ match[ 1 ] ] = match[ 2 ].trim().replace(/^(["'])(.*)\1$/, '$2');
    }
  }
}

const timezone = 'America/Bogota';
process.env.TZ = timezone;

export default defineConfig({
  testDir: './screenshots',
  testMatch: '**/*.capture.ts',
  outputDir: './test-results/screenshots',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [ [ 'list' ] ],
  timeout: 120_000,
  use: {
    ...devices[ 'Desktop Chrome' ],
    baseURL: process.env.SCREENSHOT_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    locale: 'es-CO',
    timezoneId: timezone,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
