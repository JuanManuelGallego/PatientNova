import { vi } from 'vitest';

type PrismaClientModule = typeof import('../../../src/utils/prisma/prisma-client.js');

/**
 * Boots a fresh module graph whose Prisma client runs under the given keys. The suite's static
 * client is untouched; dynamic imports made after this call resolve in the same fresh graph.
 */
export async function useKeys(keys: { current: string; previous?: string }): Promise<{
  prisma: PrismaClientModule['prisma'];
  close(): Promise<void>;
}> {
  const globals = globalThis as { __prisma?: unknown };
  const saved = globals.__prisma;
  globals.__prisma = undefined;
  vi.resetModules();
  vi.stubEnv('ENCRYPTION_KEY', keys.current);
  vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', keys.previous ?? '');
  try {
    const { prisma } = await import('../../../src/utils/prisma/prisma-client.js');
    return {
      prisma,
      async close() {
        await prisma.$disconnect();
        vi.unstubAllEnvs();
      },
    };
  } finally {
    globals.__prisma = saved;
  }
}
