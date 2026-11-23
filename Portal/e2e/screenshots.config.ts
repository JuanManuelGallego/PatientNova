import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig, devices } from '@playwright/test';

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
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
