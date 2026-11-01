import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sentEmails: { to: string; subject: string; body: string }[] = [];
vi.mock('../../../src/brevo/transactional.js', () => ({
  sendTransactionalEmail: vi.fn(async (to: string, email: { subject: string; body: string }) => {
    sentEmails.push({ to, ...email });
    return { sent: true };
  }),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { requestId } from '../../../src/middlewares/request-id.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { createPortalSessionRouter, createPublicApiRouter, portalNotFound } from '../../../src/portal/portal-routers.js';
import { verifyPortalToken } from '../../../src/auth/tokens.js';
import { createCsrfToken } from '../../../src/utils/security/csrf.js';
import { emailHash } from '../../../src/utils/encryption/blind-index.js';
import { PORTAL_OTP_LIMITS } from '../../../src/portal/portal-otp.service.js';
import { purgePortalOtpsWorker } from '../../../src/scheduler/workers/purge-portal-otps.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';
import { createTestAppointmentType, createTestLocation, createTestPatient, createTestUser } from '../helpers.js';

const ALLOWED = 'http://localhost:3000';

function buildApp() {
  const a = express();
  a.set('trust proxy', 1);
  a.use(requestId);
  a.use(helmet());
  a.use('/v1/public', createPublicApiRouter(), portalNotFound);
  a.use('/v1/portal', createPortalSessionRouter(), portalNotFound);
  a.use(errorHandler);
  return a;
}

const realFetch = globalThis.fetch;
function stubSiteverify() {
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url) !== TURNSTILE_SITEVERIFY_URL) return realFetch(url as string, init);
    const { response } = JSON.parse(String(init?.body)) as { response: string };
    if (response === 'outage') return new Response('{}', { status: 503 });
    const success = response === 'good';
    return new Response(JSON.stringify({
      success,
      ...(success
        ? { hostname: 'localhost', action: 'otp-request', challenge_ts: new Date().toISOString() }
        : { 'error-codes': [ 'invalid-input-response' ] }),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
beforeEach(() => {
  app = buildApp();
  sentEmails.length = 0;
  challenges.clear();
  stubSiteverify();
});
afterEach(() => { vi.unstubAllGlobals(); });

let seq = 0;
const newEmail = () => `paciente${++seq}-${Date.now()}@test.local`;

async function createLiveProvider(): Promise<{ id: string; slug: string }> {
  const user = await createTestUser();
  const slug = `dra-otp-${Date.now()}-${++seq}`.slice(0, 40);
  await prisma.user.update({ where: { id: user.id }, data: { bookingSlug: slug, bookingEnabled: true } });
  await prisma.availabilityRule.create({ data: { userId: user.id, weekday: 1, startMinute: 540, endMinute: 720 } });
  const type = await createTestAppointmentType(user.id);
  await prisma.appointmentType.update({ where: { id: type.id }, data: { bookableOnline: true } });
  const location = await createTestLocation(user.id);
  await prisma.appointmentLocation.update({ where: { id: location.id }, data: { bookableOnline: true } });
  return { id: user.id, slug };
}

const challenges = new Map<string, string>();
const challengeKey = (slug: string, email: string) => `${slug}:${email.trim().toLowerCase()}`;
const CHALLENGE = /^[A-Za-z0-9_-]{32}$/;
const randomChallenge = () => 'x'.repeat(32);

async function requestOtp(slug: string, email: string, captchaToken: string | null = 'good') {
  const res = await request(app).post(`/v1/public/providers/${slug}/otp`).set('Origin', ALLOWED)
    .send(captchaToken === null ? { email } : { email, captchaToken });
  if (res.status === 202) challenges.set(challengeKey(slug, email), res.body.data.challenge);
  return res;
}

const verifyOtp = (slug: string, email: string, code: string, challenge?: string) =>
  request(app).post(`/v1/portal/${slug}/otp/verify`).set('Origin', ALLOWED)
    .send({ email, code, challenge: challenge ?? challenges.get(challengeKey(slug, email)) ?? randomChallenge() });

const skipCooldown = (userId: string) => prisma.portalOtp.updateMany({
  where: { userId },
  data: { lastSentAt: new Date(Date.now() - PORTAL_OTP_LIMITS.resendCooldownMs - 1000) },
});

function lastCodeFor(email: string): string {
  const mail = [ ...sentEmails ].reverse().find((m) => m.to === email);
  if (!mail) throw new Error(`no email sent to ${email}`);
  return /\b(\d{6})\b/.exec(mail.body)![1]!;
}

const withoutVolatile = (body: Record<string, unknown>) => ({ ...body, timestamp: undefined, data: { challenge: '' } });

const otpRow = (userId: string, email: string) =>
  prisma.portalOtp.findUnique({ where: { userId_emailHash: { userId, emailHash: emailHash(email)! } } });

const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

describe('POST /v1/public/providers/:slug/otp', () => {
  it('answers the same 202 whether the email is new, a patient, deleted-only or revoked', async () => {
    const provider = await createLiveProvider();
    const fresh = newEmail();
    const existing = newEmail();
    const deletedOnly = newEmail();
    const revoked = newEmail();
    await createTestPatient(provider.id, { email: existing });
    const deleted = await createTestPatient(provider.id, { email: deletedOnly });
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });
    const off = await createTestPatient(provider.id, { email: revoked });
    await prisma.patient.update({ where: { id: off.id }, data: { portalAccessEnabled: false } });

    const responses = [];
    for (const email of [ fresh, existing, deletedOnly, revoked ]) responses.push(await requestOtp(provider.slug, email));

    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.headers[ 'set-cookie' ]).toBeUndefined();
      expect(res.headers[ 'cache-control' ]).toBe('no-store');
      expect(Object.keys(res.body.data)).toEqual([ 'challenge' ]);
      expect(res.body.data.challenge).toMatch(CHALLENGE);
      expect(withoutVolatile(res.body)).toEqual(withoutVolatile(responses[ 0 ]!.body));
    }
    expect(responses[ 0 ]!.body.success).toBe(true);
    expect(sentEmails.map((m) => m.to)).toEqual([ fresh, existing, deletedOnly, revoked ]);
  });

  it('stores only hashes and keeps the code out of the subject', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);

    const code = lastCodeFor(email);
    const mail = sentEmails.at(-1)!;
    expect(mail.subject).not.toContain(code);
    const row = await otpRow(provider.id, email);
    expect(row).toMatchObject({ attempts: 0, consumedAt: null, sendCount: 1 });
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.codeHash).not.toContain(code);
    expect(JSON.stringify(row)).not.toContain(email);
    expect(row!.expiresAt.getTime() - row!.lastSentAt.getTime()).toBe(PORTAL_OTP_LIMITS.ttlMs);
  });

  it('normalizes the email (case and whitespace) to one row', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    expect((await requestOtp(provider.slug, `  ${email.toUpperCase()} `)).status).toBe(202);
    expect(sentEmails.at(-1)!.to).toBe(email);
    expect(await prisma.portalOtp.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('does not resend within the cooldown, and a resend replaces the previous code', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const first = lastCodeFor(email);

    expect((await requestOtp(provider.slug, email)).status).toBe(202);
    expect(sentEmails).toHaveLength(1);

    await skipCooldown(provider.id);
    expect((await requestOtp(provider.slug, email)).status).toBe(202);
    expect(sentEmails).toHaveLength(2);
    const second = lastCodeFor(email);
    if (second !== first) expect((await verifyOtp(provider.slug, email, first)).status).toBe(400);
    expect((await verifyOtp(provider.slug, email, second)).status).toBe(200);
  });

  it('caps sends per email per hour, then opens a new window', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const longAgo = new Date(Date.now() - 2 * PORTAL_OTP_LIMITS.resendCooldownMs);
    await prisma.portalOtp.updateMany({
      where: { userId: provider.id },
      data: { sendCount: PORTAL_OTP_LIMITS.perEmailPerHour, lastSentAt: longAgo, sendWindowStart: new Date(Date.now() - 10 * 60_000) },
    });
    expect((await requestOtp(provider.slug, email)).status).toBe(202);
    expect(sentEmails).toHaveLength(1);

    await prisma.portalOtp.updateMany({
      where: { userId: provider.id },
      data: { sendWindowStart: new Date(Date.now() - 61 * 60_000) },
    });
    expect((await requestOtp(provider.slug, email)).status).toBe(202);
    expect(sentEmails).toHaveLength(2);
    expect((await otpRow(provider.id, email))!.sendCount).toBe(1);
  });

  it('caps sends per provider per hour without affecting other providers', async () => {
    const provider = await createLiveProvider();
    const other = await createLiveProvider();
    const now = new Date();
    await prisma.portalOtp.createMany({
      data: Array.from({ length: PORTAL_OTP_LIMITS.perProviderPerHour }, (_, i) => ({
        userId: provider.id,
        emailHash: `${i}`.padStart(64, '0'),
        codeHash: '',
        expiresAt: now,
        lastSentAt: now,
        sendWindowStart: now,
        sendCount: 1,
      })),
    });

    expect((await requestOtp(provider.slug, newEmail())).status).toBe(202);
    expect(sentEmails).toHaveLength(0);
    expect((await requestOtp(other.slug, newEmail())).status).toBe(202);
    expect(sentEmails).toHaveLength(1);
  });

  it('gives the public-page 404 for unknown and not-live providers', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });

    const unknown = await requestOtp('no-such-provider', newEmail());
    const disabled = await requestOtp(provider.slug, newEmail());
    expect(unknown.status).toBe(404);
    expect(disabled.status).toBe(404);
    expect(disabled.body.error).toBe(unknown.body.error);
    expect(sentEmails).toHaveLength(0);
  });

  it('requires a valid CAPTCHA and fails closed on a provider outage', async () => {
    const provider = await createLiveProvider();
    expect((await requestOtp(provider.slug, newEmail(), null)).status).toBe(400);
    expect((await requestOtp(provider.slug, newEmail(), 'bad')).status).toBe(400);
    expect((await requestOtp(provider.slug, newEmail(), 'outage')).status).toBe(503);
    expect(sentEmails).toHaveLength(0);
    expect(await prisma.portalOtp.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('rejects invalid emails and unknown body keys with 400', async () => {
    const provider = await createLiveProvider();
    expect((await requestOtp(provider.slug, 'not-an-email')).status).toBe(400);
    const extra = await request(app).post(`/v1/public/providers/${provider.slug}/otp`).set('Origin', ALLOWED)
      .send({ email: newEmail(), captchaToken: 'good', userId: provider.id });
    expect(extra.status).toBe(400);
    expect(sentEmails).toHaveLength(0);
  });
});

describe('POST /v1/portal/:slug/otp/verify', () => {
  it('starts a session: cookie, CSRF token bound to the sid, no patient lookup', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);

    const res = await verifyOtp(provider.slug, email, lastCodeFor(email));
    expect(res.status).toBe(200);
    expect(res.headers[ 'cache-control' ]).toBe('no-store');
    const cookie = String(res.headers[ 'set-cookie' ]?.[ 0 ]);
    expect(cookie).toMatch(/^portal_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/v1\/portal/);
    expect(cookie).toMatch(/Max-Age=7200/);

    const token = decodeURIComponent(cookie.split(';')[ 0 ]!.slice('portal_session='.length));
    const claims = verifyPortalToken(token) as { userId: string; email: string; sid: string; typ: string };
    expect(claims).toMatchObject({ userId: provider.id, email, typ: 'portal' });
    expect(claims.sid).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.data).toEqual({
      email,
      expiresAt: expect.any(String),
      csrfToken: createCsrfToken(claims.sid, config.auth.portalJwtSecret),
    });
    expect((await otpRow(provider.id, email))!.consumedAt).not.toBeNull();
  });

  it('accepts the code with a differently-cased email', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    expect((await verifyOtp(provider.slug, ` ${email.toUpperCase()}`, lastCodeFor(email))).status).toBe(200);
  });

  it('locks the code after the maximum wrong attempts, even against the right one', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const code = lastCodeFor(email);

    const wrong = await verifyOtp(provider.slug, email, wrongCode(code));
    expect(wrong.status).toBe(400);
    for (let i = 1; i < PORTAL_OTP_LIMITS.maxAttempts; i++) {
      expect((await verifyOtp(provider.slug, email, wrongCode(code))).status).toBe(400);
    }
    expect((await otpRow(provider.id, email))!.attempts).toBe(PORTAL_OTP_LIMITS.maxAttempts);

    const right = await verifyOtp(provider.slug, email, code);
    expect(right.status).toBe(400);
    expect(right.body.error).toBe(wrong.body.error);
    expect(right.headers[ 'set-cookie' ]).toBeUndefined();
  });

  it('rejects expired, reused and never-requested codes with the same error', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const code = lastCodeFor(email);

    expect((await verifyOtp(provider.slug, email, code)).status).toBe(200);
    const reused = await verifyOtp(provider.slug, email, code);
    expect(reused.status).toBe(400);

    const other = newEmail();
    await requestOtp(provider.slug, other);
    await prisma.portalOtp.updateMany({ where: { emailHash: emailHash(other)! }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await verifyOtp(provider.slug, other, lastCodeFor(other));
    const never = await verifyOtp(provider.slug, newEmail(), '123456');

    for (const res of [ expired, never ]) {
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(reused.body.error);
    }
    expect(reused.body.error).toBe('Invalid or expired code');
  });

  it("rejects provider A's code on provider B", async () => {
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    const email = newEmail();
    await requestOtp(a.slug, email);
    const codeA = lastCodeFor(email);
    await requestOtp(b.slug, email);
    const codeB = lastCodeFor(email);

    if (codeA !== codeB) expect((await verifyOtp(b.slug, email, codeA)).status).toBe(400);
    expect((await verifyOtp(a.slug, email, codeA)).status).toBe(200);
  });

  it('gives exactly one session to concurrent verifies of the right code', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const code = lastCodeFor(email);

    const results = await Promise.all([ verifyOtp(provider.slug, email, code), verifyOtp(provider.slug, email, code) ]);
    expect(results.map((r) => r.status).sort()).toEqual([ 200, 400 ]);
  });

  it('requires the exact Origin but no CSRF header, and keeps the 10kb body limit', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);

    const noOrigin = await request(app).post(`/v1/portal/${provider.slug}/otp/verify`).send({ email, code: lastCodeFor(email) });
    expect(noOrigin.status).toBe(403);
    const big = await request(app).post(`/v1/portal/${provider.slug}/otp/verify`).set('Origin', ALLOWED)
      .set('Content-Type', 'application/json').send(JSON.stringify({ email, code: '123456', pad: 'x'.repeat(11 * 1024) }));
    expect(big.status).toBe(413);
    expect((await verifyOtp(provider.slug, email, lastCodeFor(email))).status).toBe(200);
  });

  it('rejects malformed codes with 400 without counting an attempt', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    expect((await verifyOtp(provider.slug, email, '12ab56')).status).toBe(400);
    expect((await otpRow(provider.id, email))!.attempts).toBe(0);
  });
});

describe('verify challenge', () => {
  it('never counts attempts made with a wrong challenge, so strangers cannot lock the code', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const code = lastCodeFor(email);

    for (let i = 0; i < PORTAL_OTP_LIMITS.maxAttempts + 1; i++) {
      expect((await verifyOtp(provider.slug, email, wrongCode(code), randomChallenge())).status).toBe(400);
    }
    const rightCodeWrongChallenge = await verifyOtp(provider.slug, email, code, randomChallenge());
    expect(rightCodeWrongChallenge.status).toBe(400);
    expect(rightCodeWrongChallenge.body.error).toBe('Invalid or expired code');
    expect((await otpRow(provider.id, email))!.attempts).toBe(0);

    expect((await verifyOtp(provider.slug, email, code)).status).toBe(200);
  });

  it('answers a throttled request with an unused challenge that verify rejects', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    const real = (await requestOtp(provider.slug, email)).body.data.challenge;
    const throttled = (await requestOtp(provider.slug, email)).body.data.challenge;
    expect(sentEmails).toHaveLength(1);
    expect(throttled).toMatch(CHALLENGE);
    expect(throttled).not.toBe(real);

    const code = lastCodeFor(email);
    expect((await verifyOtp(provider.slug, email, code, throttled)).status).toBe(400);
    expect((await verifyOtp(provider.slug, email, code, real)).status).toBe(200);
  });

  it('recovers from a locked code with a new one, and lets the patient log in again later', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    const locked = lastCodeFor(email);
    for (let i = 0; i < PORTAL_OTP_LIMITS.maxAttempts; i++) await verifyOtp(provider.slug, email, wrongCode(locked));
    expect((await verifyOtp(provider.slug, email, locked)).status).toBe(400);

    await skipCooldown(provider.id);
    await requestOtp(provider.slug, email);
    expect((await verifyOtp(provider.slug, email, lastCodeFor(email))).status).toBe(200);

    await skipCooldown(provider.id);
    await requestOtp(provider.slug, email);
    expect((await verifyOtp(provider.slug, email, lastCodeFor(email))).status).toBe(200);
  });
});

describe('daily failure cap', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('counts wrong codes across resends, then stops sending until the 24h window passes', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    const codes = Math.ceil(PORTAL_OTP_LIMITS.maxFailuresPerDay / PORTAL_OTP_LIMITS.maxAttempts);
    for (let c = 0; c < codes; c++) {
      if (c > 0) await skipCooldown(provider.id);
      await requestOtp(provider.slug, email);
      const code = lastCodeFor(email);
      for (let i = 0; i < PORTAL_OTP_LIMITS.maxAttempts; i++) {
        expect((await verifyOtp(provider.slug, email, wrongCode(code))).status).toBe(400);
      }
    }
    expect((await otpRow(provider.id, email))!.failedCount).toBe(PORTAL_OTP_LIMITS.maxFailuresPerDay);

    await skipCooldown(provider.id);
    const sentBefore = sentEmails.length;
    const capped = await requestOtp(provider.slug, email);
    expect(capped.status).toBe(202);
    expect(capped.body.data.challenge).toMatch(CHALLENGE);
    expect(sentEmails.length).toBe(sentBefore);

    await prisma.portalOtp.updateMany({
      where: { userId: provider.id },
      data: { failedWindowStart: new Date(Date.now() - DAY_MS - 1000) },
    });
    await skipCooldown(provider.id);
    await requestOtp(provider.slug, email);
    expect(sentEmails.length).toBe(sentBefore + 1);
    expect((await verifyOtp(provider.slug, email, lastCodeFor(email))).status).toBe(200);
    expect((await otpRow(provider.id, email))!.failedCount).toBe(0);
  });

  it('rejects the right code once the cap is reached, without counting an attempt', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    await requestOtp(provider.slug, email);
    await prisma.portalOtp.updateMany({
      where: { userId: provider.id },
      data: { failedCount: PORTAL_OTP_LIMITS.maxFailuresPerDay, failedWindowStart: new Date() },
    });

    const res = await verifyOtp(provider.slug, email, lastCodeFor(email));
    expect(res.status).toBe(400);
    expect(res.headers[ 'set-cookie' ]).toBeUndefined();
    const row = (await otpRow(provider.id, email))!;
    expect(row.attempts).toBe(0);
    expect(row.consumedAt).toBeNull();
  });
});

describe('purgePortalOtpsWorker', () => {
  it('deletes rows not sent to for a day and keeps recent ones', async () => {
    const provider = await createLiveProvider();
    const recent = newEmail();
    await requestOtp(provider.slug, recent);
    const now = new Date();
    await prisma.portalOtp.create({
      data: {
        userId: provider.id,
        emailHash: 'f'.repeat(64),
        codeHash: '',
        expiresAt: now,
        lastSentAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        sendWindowStart: now,
      },
    });

    await purgePortalOtpsWorker();
    const left = await prisma.portalOtp.findMany({ where: { userId: provider.id } });
    expect(left.map((r) => r.emailHash)).toEqual([ emailHash(recent) ]);
  });
});
