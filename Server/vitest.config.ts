import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        // Unit tests: fast, no external dependencies (Prisma/DB are mocked).
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        // Integration tests: hit a real Postgres database.
        // Require DATABASE_URL to point at a disposable test DB.
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          setupFiles: ['test/integration/setup.ts'],
          // A single DB is shared, so avoid parallel file execution clobbering data.
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
