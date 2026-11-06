import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadCap(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv('PORTAL_OTP_PAID_DAILY_CAP', value as string);
  const { config } = await import('../../../src/utils/config/config.js');
  return config.portal.otpPaidDailyCap;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('PORTAL_OTP_PAID_DAILY_CAP', () => {
  it('reads a configured value', async () => {
    await expect(loadCap('50')).resolves.toBe(50);
  });

  it('uses the default when it is blank', async () => {
    await expect(loadCap('')).resolves.toBe(300);
    await expect(loadCap('   ')).resolves.toBe(300);
  });

  it.each([ 'abc', '300,', '-1', '0', '1.5' ])('refuses to boot with %s, which would remove the ceiling', async (value) => {
    await expect(loadCap(value)).rejects.toThrow('PORTAL_OTP_PAID_DAILY_CAP must be a positive integer');
  });
});
