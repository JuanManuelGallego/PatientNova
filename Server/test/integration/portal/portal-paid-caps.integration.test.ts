import { afterEach, describe, expect, it } from 'vitest';
import { BookingRequestStatus, Channel } from '../../../generated/prisma/enums.js';
import { config } from '../../../src/utils/config/config.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { phoneHash } from '../../../src/utils/encryption/blind-index.js';
import { checkPaidCaps } from '../../../src/portal/portal-paid-caps.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import { createLiveProvider, type LiveProvider } from './portal-helpers.js';

const HOUR = 3_600_000;
const portal = config.portal as { whatsappDailyCap: number };
const capWas = portal.whatsappDailyCap;
afterEach(() => { portal.whatsappDailyCap = capWas; });

let seq = 0;
const number = () => `+57300${String(1_000_000 + (seq++)).slice(1).padStart(7, '0')}`;

async function row(p: LiveProvider, value: string, opts: { channel?: Channel; ageMs?: number } = {}) {
  const start = new Date(Date.now() + 10 * 24 * HOUR);
  return prisma.bookingRequest.create({
    data: {
      userId: p.id,
      status: BookingRequestStatus.CANCELLED,
      contactChannel: opts.channel ?? Channel.WHATSAPP,
      email: 'lucia@example.com',
      verifiedPhone: value,
      name: 'Lucia',
      lastName: 'Rojas',
      typeId: p.typeId,
      locationId: p.locationId,
      startAt: start,
      endAt: new Date(start.getTime() + HOUR),
      patientTimezone: 'America/Bogota',
      holdExpiresAt: start,
      policyVersion: PRIVACY_POLICY_VERSION,
      consentAcceptedAt: new Date(),
      createdAt: new Date(Date.now() - (opts.ageMs ?? 0)),
    },
  });
}

const check = (p: LiveProvider, value: string) =>
  prisma.$transaction((tx) => checkPaidCaps(tx, p.id, phoneHash(value)!, new Date()));

describe('checkPaidCaps', () => {
  it('allows 3 requests per number per hour, then phone-cap', async () => {
    const p = await createLiveProvider();
    const n = number();
    for (let i = 0; i < 2; i++) await row(p, n);
    expect(await check(p, n)).toBeNull();
    await row(p, n);
    expect(await check(p, n)).toBe('phone-cap');
  });

  it('counts distinct numbers per provider: the 31st new number in an hour is provider-paid-cap', async () => {
    const p = await createLiveProvider();
    for (let i = 0; i < 30; i++) await row(p, number());
    expect(await check(p, number())).toBe('provider-paid-cap');
  });

  it('daily cap counts distinct numbers across providers in 24h', async () => {
    portal.whatsappDailyCap = 3;
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    await row(a, number());
    await row(b, number());
    expect(await check(a, number())).toBeNull();
    await row(b, number());
    expect(await check(a, number())).toBe('paid-daily-cap');
  });

  it('EMAIL requests never count', async () => {
    const p = await createLiveProvider();
    const n = number();
    for (let i = 0; i < 5; i++) await row(p, n, { channel: Channel.EMAIL });
    portal.whatsappDailyCap = 1;
    expect(await check(p, n)).toBeNull();
  });

  it('rows older than the window do not count', async () => {
    const p = await createLiveProvider();
    const n = number();
    for (let i = 0; i < 3; i++) await row(p, n, { ageMs: HOUR + 60_000 });
    expect(await check(p, n)).toBeNull();
    portal.whatsappDailyCap = 3;
    for (let i = 0; i < 3; i++) await row(p, number(), { ageMs: 25 * HOUR });
    expect(await check(p, number())).toBeNull();
  });
});
