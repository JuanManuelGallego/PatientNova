import { execSync } from 'node:child_process';
import { beforeAll, beforeEach, afterAll } from 'vitest';

// Guard: integration tests must run against a disposable test database.
// This prevents accidentally wiping a real/dev database.
const dbUrl = process.env.DATABASE_URL ?? '';

if (!dbUrl) {
  throw new Error(
    'Integration tests require DATABASE_URL to point at a disposable test database. ' +
      'Start one with: docker compose -f docker-compose.test.yml up -d',
  );
}

if (!/test/i.test(dbUrl)) {
  throw new Error(
    `Refusing to run integration tests: DATABASE_URL does not contain "test" (${dbUrl}). ` +
      'Point it at a dedicated test database to avoid data loss.',
  );
}

// Applied once per test process. `prisma migrate deploy` is idempotent.
beforeAll(() => {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  });
});

// Import after the guard so a misconfigured URL fails before any DB connection.
const { prisma } = await import('../../src/prisma/prismaClient.js');

// Truncate all application tables between tests for isolation.
// Excludes Prisma's own migration table and the pg-boss schema.
beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma_%'
  `;

  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
