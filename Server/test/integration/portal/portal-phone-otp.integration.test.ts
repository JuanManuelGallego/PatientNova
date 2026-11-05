import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sendWhatsApp: vi.fn(), sendSms: vi.fn(), sendEmail: vi.fn() }));
vi.mock('../../../src/twilio/client.js', () => ({ sendWhatsApp: mocks.sendWhatsApp, sendSms: mocks.sendSms }));
vi.mock('../../../src/brevo/transactional.js', () => ({ sendTransactionalEmail: mocks.sendEmail }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { logger } from '../../../src/utils/api/logger.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';
import { PORTAL_OTP_LIMITS } from '../../../src/portal/portal-otp.service.js';
import { PORTAL_COOKIE_NAME } from '../../../src/auth/portal-cookie.js';
import { verifyPortalToken } from '../../../src/auth/tokens.js';
import { phoneHash } from '../../../src/utils/encryption/blind-index.js';
import { Channel } from '../../../generated/prisma/enums.js';
import { createTestPatient } from '../helpers.js';
import { ALLOWED_ORIGIN, buildPortalApp, createLiveProvider, type LiveProvider } from './portal-helpers.js';

const portal = config.portal as {
  patientEnabled: boolean;
  phoneLoginEnabled: boolean;
  phoneLoginChannels: string[];
  otpPhoneCountryCodes: string[];
  otpPaidDailyCap: number;
};
const was = { ...portal };

beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { Object.assign(portal, was); });

let app: express.Express;
let seq = 0;
const newPhone = () => `+57300${String(1_000_000 + (++seq * 7) % 8_999_999).padStart(7, '0')}`;
const newEmail = () => `paciente${++seq}-${Date.now()}@test.local`;

const realFetch = globalThis.fetch;

beforeEach(() => {
  app = buildPortalApp();
  Object.assign(portal, was, { patientEnabled: true, phoneLoginEnabled: true });
  mocks.sendWhatsApp.mockReset().mockResolvedValue({ success: true, messageSid: 'wa-1' });
  mocks.sendSms.mockReset().mockResolvedValue({ success: true, messageSid: 'sms-1' });
  mocks.sendEmail.mockReset().mockResolvedValue({ sent: true });
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url) !== TURNSTILE_SITEVERIFY_URL) return realFetch(url as string, init);
    return new Response(JSON.stringify({ success: true, hostname: 'localhost', action: 'otp-request', challenge_ts: new Date().toISOString() }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const requestOtp = (slug: string, body: object) =>
  request(app).post(`/v1/public/providers/${slug}/otp`).set('Origin', ALLOWED_ORIGIN).send({ captchaToken: 'good', ...body });

const verifyOtp = (slug: string, body: object) =>
  request(app).post(`/v1/portal/${slug}/otp/verify`).set('Origin', ALLOWED_ORIGIN).send(body);

const requestPhoneOtp = (slug: string, phone: string, channel: Channel = Channel.WHATSAPP) => requestOtp(slug, { phone, channel });

const otpRow = (userId: string, phone: string) =>
  prisma.portalOtp.findUnique({ where: { userId_contactHash: { userId, contactHash: phoneHash(phone)! } } });

const skipCooldown = (userId: string) => prisma.portalOtp.updateMany({
  where: { userId },
  data: { lastSentAt: new Date(Date.now() - PORTAL_OTP_LIMITS.resendCooldownMs - 1000) },
});

const whatsappCode = (call = -1): string => mocks.sendWhatsApp.mock.calls.at(call)![0].contentVariables['1'];
const smsCode = (call = -1): string => /\b(\d{6})\b/.exec(mocks.sendSms.mock.calls.at(call)![0].body as string)![1]!;

const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

function paidRows(userId: string, count: number, offset = 0) {
  const now = new Date();
  return prisma.portalOtp.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      contactHash: `${offset + i}`.padStart(64, 'a'),
      channel: Channel.SMS,
      codeHash: '',
      expiresAt: now,
      lastSentAt: now,
      sendWindowStart: now,
      sendCount: 1,
    })),
  });
}

function capturedLogs() {
  const lines: unknown[][] = [];
  for (const level of [ 'debug', 'info', 'warn', 'error' ] as const) {
    vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => { lines.push([ level, ...args ]); }) as never);
  }
  return lines;
}

describe('POST /v1/public/providers/:slug/otp with a phone', () => {
  it('sends the WhatsApp code through the authentication template', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();

    const res = await requestPhoneOtp(provider.slug, phone);

    expect(res.status).toBe(202);
    expect(Object.keys(res.body.data)).toEqual([ 'challenge' ]);
    expect(mocks.sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(mocks.sendWhatsApp.mock.calls[0]![0]).toMatchObject({
      to: phone,
      contentSid: config.twilio.patientPortal.otpSid,
      contentVariables: { '1': expect.stringMatching(/^\d{6}$/) },
    });
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('says in the SMS what the code is for and for which provider, because the sender is overwritten', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { displayName: 'Dra. Ana Pública' } });
    const phone = newPhone();

    await requestPhoneOtp(provider.slug, phone, Channel.SMS);

    const { to, body } = mocks.sendSms.mock.calls[0]![0] as { to: string; body: string };
    expect(to).toBe(phone);
    expect(body).toContain('Dra. Ana Pública');
    expect(body).toMatch(/\b\d{6}\b/);
    expect(body).toContain('10 minutos');
    expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
  });

  it('answers byte-identically for a new number, a patient\'s number and a revoked number', async () => {
    const provider = await createLiveProvider();
    const [ fresh, known, revoked, flagged ] = [ newPhone(), newPhone(), newPhone(), newPhone() ];
    const patient = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: patient.id }, data: { whatsappNumber: known } });
    const off = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: off.id }, data: { whatsappNumber: revoked, portalAccessEnabled: false } });
    const unverified = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: unverified.id }, data: { whatsappNumber: flagged, whatsappUnverified: true } });

    const responses = [];
    for (const phone of [ fresh, known, revoked, flagged ]) responses.push(await requestPhoneOtp(provider.slug, phone));

    const volatile = (res: request.Response) => ({
      status: res.status,
      body: { ...res.body, timestamp: '', data: { challenge: (res.body.data.challenge as string).length } },
      type: res.headers[ 'content-type' ],
      cache: res.headers[ 'cache-control' ],
    });
    expect(responses.map(volatile)).toEqual(Array(4).fill(volatile(responses[ 0 ]!)));
    expect(mocks.sendWhatsApp.mock.calls.map(([ m ]) => m.to)).toEqual([ fresh, known, revoked, flagged ]);
  });

  it('never stores, logs or passes the code to the logger in plain form', async () => {
    const provider = await createLiveProvider();
    const lines = capturedLogs();
    const phone = newPhone();

    await requestPhoneOtp(provider.slug, phone);
    const code = whatsappCode();
    await skipCooldown(provider.id);
    await requestPhoneOtp(provider.slug, phone, Channel.SMS);
    const second = smsCode();

    const row = await otpRow(provider.id, phone);
    expect(JSON.stringify(row)).not.toContain(second);
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    const logged = JSON.stringify(lines);
    expect(logged).not.toContain(code);
    expect(logged).not.toContain(second);
    expect(logged).not.toContain(phone);
    expect(logged).not.toContain('contentVariables');
  });

  it('still answers 202 when Twilio refuses the message, and logs no number', async () => {
    const provider = await createLiveProvider();
    const lines = capturedLogs();
    const phone = newPhone();
    mocks.sendWhatsApp.mockRejectedValueOnce(Object.assign(new Error(`Blocked: ${phone}`), { code: 21610 }));

    const res = await requestPhoneOtp(provider.slug, phone);

    expect(res.status).toBe(202);
    expect(JSON.stringify(lines)).not.toContain(phone);
    expect(lines.some(([ level, , msg ]) => level === 'error' && msg === 'Portal OTP could not be sent')).toBe(true);
  });

  describe('validation', () => {
    it('rejects a number from a country that is not allowed before any row is written', async () => {
      const provider = await createLiveProvider();
      const phone = '+14155550123';

      const res = await requestPhoneOtp(provider.slug, phone);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Phone country not supported');
      expect(await prisma.portalOtp.count({ where: { userId: provider.id } })).toBe(0);
      expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
    });

    it('accepts every configured country code', async () => {
      const provider = await createLiveProvider();
      portal.otpPhoneCountryCodes = [ '57', '1' ];
      expect((await requestPhoneOtp(provider.slug, '+14155550123')).status).toBe(202);
    });

    it('rejects the phone body while the flag is off, without writing a row or sending', async () => {
      const provider = await createLiveProvider();
      portal.phoneLoginEnabled = false;

      const res = await requestPhoneOtp(provider.slug, newPhone());

      expect(res.status).toBe(400);
      expect(await prisma.portalOtp.count({ where: { userId: provider.id } })).toBe(0);
      expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
    });

    it('rejects a channel left out of the login channels', async () => {
      const provider = await createLiveProvider();
      portal.phoneLoginChannels = [ 'WHATSAPP' ];

      expect((await requestPhoneOtp(provider.slug, newPhone(), Channel.SMS)).status).toBe(400);
      expect((await requestPhoneOtp(provider.slug, newPhone(), Channel.WHATSAPP)).status).toBe(202);
    });

    it.each([
      [ 'no channel', { phone: '+573001112233' } ],
      [ 'the email channel', { phone: '+573001112233', channel: 'EMAIL' } ],
      [ 'a number that is not E.164', { phone: '3001112233', channel: 'SMS' } ],
      [ 'an email and a phone together', { email: 'a@test.local', phone: '+573001112233', channel: 'SMS' } ],
      [ 'an unknown field', { phone: '+573001112233', channel: 'SMS', extra: 1 } ],
    ])('rejects %s', async (_name, body) => {
      const provider = await createLiveProvider();
      expect((await requestOtp(provider.slug, body)).status).toBe(400);
    });

    it('keeps accepting the email body, with the flag on or off', async () => {
      const provider = await createLiveProvider();
      expect((await requestOtp(provider.slug, { email: newEmail() })).status).toBe(202);
      portal.phoneLoginEnabled = false;
      expect((await requestOtp(provider.slug, { email: newEmail() })).status).toBe(202);
      expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('limits', () => {
    function errorLines(lines: unknown[][]) {
      return lines.filter(([ level ]) => level === 'error');
    }

    it('WhatsApp and SMS share one row, one cooldown and one failure count', async () => {
      const provider = await createLiveProvider();
      const phone = newPhone();

      await requestPhoneOtp(provider.slug, phone);
      const inCooldown = await requestPhoneOtp(provider.slug, phone, Channel.SMS);

      expect(inCooldown.status).toBe(202);
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(await prisma.portalOtp.count({ where: { userId: provider.id } })).toBe(1);

      const first = await verifyOtp(provider.slug, { phone, code: wrong(whatsappCode()), challenge: 'x'.repeat(32) });
      expect(first.status).toBe(400);

      await prisma.portalOtp.updateMany({ where: { userId: provider.id }, data: { failedCount: PORTAL_OTP_LIMITS.maxFailuresPerDay } });
      await skipCooldown(provider.id);
      await requestPhoneOtp(provider.slug, phone, Channel.SMS);
      expect(mocks.sendSms).not.toHaveBeenCalled();
    });

    it('caps sends per number, answering the usual 202 and reporting it without PII', async () => {
      const provider = await createLiveProvider();
      const lines = capturedLogs();
      const phone = newPhone();

      for (let i = 0; i < PORTAL_OTP_LIMITS.perPhonePerHour; i++) {
        expect((await requestPhoneOtp(provider.slug, phone, i % 2 ? Channel.SMS : Channel.WHATSAPP)).status).toBe(202);
        await skipCooldown(provider.id);
      }
      const sent = mocks.sendWhatsApp.mock.calls.length + mocks.sendSms.mock.calls.length;
      expect(sent).toBe(PORTAL_OTP_LIMITS.perPhonePerHour);

      const capped = await requestPhoneOtp(provider.slug, phone);

      expect(capped.status).toBe(202);
      expect(capped.body.data.challenge).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(mocks.sendWhatsApp.mock.calls.length + mocks.sendSms.mock.calls.length).toBe(sent);
      const errors = errorLines(lines);
      expect(errors).toHaveLength(1);
      expect(errors[ 0 ]![2]).toBe('Portal OTP paid cap reached: phone-cap');
      expect(JSON.stringify(errors)).not.toContain(phone.slice(-4));
    });

    it('caps paid sends per provider without touching email or other providers', async () => {
      const provider = await createLiveProvider();
      const other = await createLiveProvider();
      const lines = capturedLogs();
      await paidRows(provider.id, PORTAL_OTP_LIMITS.perProviderPaidPerHour);

      const capped = await requestPhoneOtp(provider.slug, newPhone());
      expect(capped.status).toBe(202);
      expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
      expect(errorLines(lines)[ 0 ]![2]).toBe('Portal OTP paid cap reached: provider-paid-cap');

      expect((await requestOtp(provider.slug, { email: newEmail() })).status).toBe(202);
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
      await requestPhoneOtp(other.slug, newPhone());
      expect(mocks.sendWhatsApp).toHaveBeenCalledTimes(1);
    });

    it('caps paid sends across all providers', async () => {
      const providers: LiveProvider[] = [ await createLiveProvider(), await createLiveProvider() ];
      const lines = capturedLogs();
      portal.otpPaidDailyCap = 4;
      await paidRows(providers[ 0 ]!.id, 2);
      await paidRows(providers[ 1 ]!.id, 2, 2);

      const capped = await requestPhoneOtp(providers[ 0 ]!.slug, newPhone());

      expect(capped.status).toBe(202);
      expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
      expect(errorLines(lines)[ 0 ]![2]).toBe('Portal OTP paid cap reached: paid-daily-cap');
    });

    it('does not count email rows against the paid caps', async () => {
      const provider = await createLiveProvider();
      portal.otpPaidDailyCap = 1;
      await requestOtp(provider.slug, { email: newEmail() });
      await requestOtp(provider.slug, { email: newEmail() });

      await requestPhoneOtp(provider.slug, newPhone());

      expect(mocks.sendWhatsApp).toHaveBeenCalledTimes(1);
    });
  });
});

describe('POST /v1/portal/:slug/otp/verify with a phone', () => {
  it('starts a phone session whose channel comes from the row', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const { body } = await requestPhoneOtp(provider.slug, phone, Channel.SMS);

    const res = await verifyOtp(provider.slug, { phone, code: smsCode(), challenge: body.data.challenge });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: null, contact: phone, contactChannel: Channel.SMS });
    const cookie = (res.headers[ 'set-cookie' ] as unknown as string[]).find((c) => c.startsWith(`${PORTAL_COOKIE_NAME}=`))!;
    const claims = verifyPortalToken(cookie.split(';')[ 0 ]!.split('=')[ 1 ]!) as Record<string, unknown>;
    expect(claims).toMatchObject({ channel: Channel.SMS, phone, userId: provider.id });
    expect(claims.email).toBeUndefined();

    const session = await request(app).get('/v1/portal/session').set('Origin', ALLOWED_ORIGIN).set('Cookie', cookie.split(';')[ 0 ]!);
    expect(session.body.data).toMatchObject({ email: null, contact: phone, contactChannel: Channel.SMS });
  });

  it('a client cannot choose the channel of the session', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const { body } = await requestPhoneOtp(provider.slug, phone, Channel.SMS);

    const res = await verifyOtp(provider.slug, { phone, channel: Channel.WHATSAPP, code: smsCode(), challenge: body.data.challenge });

    expect(res.status).toBe(400);
  });

  it('a resend on the other channel replaces the code and the channel', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const first = await requestPhoneOtp(provider.slug, phone, Channel.WHATSAPP);
    const firstCode = whatsappCode();
    await skipCooldown(provider.id);

    const second = await requestPhoneOtp(provider.slug, phone, Channel.SMS);

    expect((await otpRow(provider.id, phone))!.channel).toBe(Channel.SMS);
    const stale = await verifyOtp(provider.slug, { phone, code: firstCode, challenge: first.body.data.challenge });
    expect(stale.status).toBe(400);
    const res = await verifyOtp(provider.slug, { phone, code: smsCode(), challenge: second.body.data.challenge });
    expect(res.status).toBe(200);
    expect(res.body.data.contactChannel).toBe(Channel.SMS);
  });

  it('gives one answer for a wrong code, a wrong challenge and an unknown number', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const { body } = await requestPhoneOtp(provider.slug, phone);
    const code = whatsappCode();

    const wrongCode = await verifyOtp(provider.slug, { phone, code: wrong(code), challenge: body.data.challenge });
    const wrongChallenge = await verifyOtp(provider.slug, { phone, code, challenge: 'x'.repeat(32) });
    const unknown = await verifyOtp(provider.slug, { phone: newPhone(), code, challenge: body.data.challenge });

    for (const res of [ wrongCode, wrongChallenge, unknown ]) {
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid or expired code');
    }
  });

  it('rejects a phone verify while the flag is off', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const { body } = await requestPhoneOtp(provider.slug, phone);
    portal.phoneLoginEnabled = false;

    const res = await verifyOtp(provider.slug, { phone, code: whatsappCode(), challenge: body.data.challenge });

    expect(res.status).toBe(400);
  });
});

describe('GET /v1/public/providers/:slug', () => {
  const profile = (slug: string) => request(app).get(`/v1/public/providers/${slug}`).set('Origin', ALLOWED_ORIGIN);

  it('offers only email while the flag is off', async () => {
    const provider = await createLiveProvider();
    portal.phoneLoginEnabled = false;
    expect((await profile(provider.slug)).body.data.loginChannels).toEqual([ Channel.EMAIL ]);
  });

  it('offers the configured phone channels with the flag on', async () => {
    const provider = await createLiveProvider();
    expect((await profile(provider.slug)).body.data.loginChannels).toEqual([ Channel.EMAIL, Channel.WHATSAPP, Channel.SMS ]);
    portal.phoneLoginChannels = [ 'WHATSAPP' ];
    expect((await profile(provider.slug)).body.data.loginChannels).toEqual([ Channel.EMAIL, Channel.WHATSAPP ]);
  });
});
