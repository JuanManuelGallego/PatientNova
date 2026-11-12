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
    await expect(loadCap('')).resolves.toBe(60);
    await expect(loadCap('   ')).resolves.toBe(60);
  });

  it.each([ 'abc', '300,', '-1', '0', '1.5' ])('refuses to boot with %s, which would remove the ceiling', async (value) => {
    await expect(loadCap(value)).rejects.toThrow('PORTAL_OTP_PAID_DAILY_CAP must be a positive integer');
  });
});

async function loadWhatsAppCap(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv('PORTAL_WHATSAPP_DAILY_CAP', value as string);
  const { config } = await import('../../../src/utils/config/config.js');
  return config.portal.whatsappDailyCap;
}

describe('PORTAL_WHATSAPP_DAILY_CAP', () => {
  it('reads a configured value', async () => {
    await expect(loadWhatsAppCap('50')).resolves.toBe(50);
  });

  it('uses the default when it is blank', async () => {
    await expect(loadWhatsAppCap('')).resolves.toBe(60);
    await expect(loadWhatsAppCap('   ')).resolves.toBe(60);
  });

  it.each([ 'abc', '300,', '-1', '0', '1.5' ])('refuses to boot with %s, which would remove the ceiling', async (value) => {
    await expect(loadWhatsAppCap(value)).rejects.toThrow('PORTAL_WHATSAPP_DAILY_CAP must be a positive integer');
  });
});


async function loadSids(confirmLink: string, unconfirmed: string) {
  vi.resetModules();
  vi.stubEnv('TWILIO_WHATSAPP_PATIENT_PORTAL_CONFIRM_LINK_SID', confirmLink);
  vi.stubEnv('TWILIO_WHATSAPP_PATIENT_PORTAL_BOOKING_UNCONFIRMED_SID', unconfirmed);
  const { config } = await import('../../../src/utils/config/config.js');
  const { confirmLinkSid, unconfirmedExpiredSid } = config.twilio.patientPortal;
  return { confirmLinkSid, unconfirmedExpiredSid };
}

describe('WhatsApp confirmation template SIDs (optional until Meta approves them)', () => {
  it('boots without them and reads a blank value as null', async () => {
    await expect(loadSids('', '  ')).resolves.toEqual({ confirmLinkSid: null, unconfirmedExpiredSid: null });
  });

  it('reads configured values', async () => {
    await expect(loadSids('HXconfirm', 'HXexpired')).resolves.toEqual({ confirmLinkSid: 'HXconfirm', unconfirmedExpiredSid: 'HXexpired' });
  });
});
