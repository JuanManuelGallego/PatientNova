import type express from 'express';
import { Router as ExpressRouter } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactionalEmail } = vi.hoisted(() => ({ sendTransactionalEmail: vi.fn(async () => ({ sent: true })) }));
vi.mock('../../../src/brevo/transactional.js', () => ({ sendTransactionalEmail }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { emailHash } from '../../../src/utils/encryption/blind-index.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';
import { createPortalSessionRouter, createPublicApiRouter } from '../../../src/portal/portal-routers.js';
import { ALLOWED_ORIGIN, buildPortalApp, createLiveProvider } from './portal-helpers.js';


const FIFTEEN_MIN_LIMITS = { otpRequest: 10, otpVerify: 20, booking: 10, change: 10 } as const;

let app: express.Express;
let siteverifyCalls = 0;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
const realFetch = globalThis.fetch;

beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
beforeEach(() => {
  app = buildPortalApp();
  siteverifyCalls = 0;
  sendTransactionalEmail.mockClear();
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url) !== TURNSTILE_SITEVERIFY_URL) return realFetch(url as string, init);
    siteverifyCalls++;
    return new Response(JSON.stringify({
      success: true, hostname: 'localhost', action: 'otp-request', challenge_ts: new Date().toISOString(),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

let seq = 0;
const newEmail = () => `abuso${++seq}-${Date.now()}@test.local`;

function expectJson429(res: request.Response) {
  expect(res.status).toBe(429);
  expect(res.body).toMatchObject({ success: false });
  expect(res.headers[ 'set-cookie' ]).toBeUndefined();
}

const postFrom = (ip: string, path: string) =>
  request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('X-Forwarded-For', ip);

describe('otp-request-ip', () => {
  it(`allows ${FIFTEEN_MIN_LIMITS.otpRequest} requests per IP, then 429 before CAPTCHA, storage or email`, async () => {
    const provider = await createLiveProvider();
    const path = `/v1/public/providers/${provider.slug}/otp`;
    const ip = '198.51.100.10';

    for (let i = 0; i < FIFTEEN_MIN_LIMITS.otpRequest; i++) {
      const res = await postFrom(ip, path).send({ email: newEmail(), captchaToken: 'good' });
      expect(res.status).toBe(202);
    }
    const sendsBefore = sendTransactionalEmail.mock.calls.length;
    const verifiesBefore = siteverifyCalls;

    const email = newEmail();
    expectJson429(await postFrom(ip, path).send({ email, captchaToken: 'good' }));
    expect(siteverifyCalls).toBe(verifiesBefore);
    expect(sendTransactionalEmail.mock.calls.length).toBe(sendsBefore);
    expect(await prisma.portalOtp.count({ where: { userId: provider.id, contactHash: emailHash(email)! } })).toBe(0);

    expect((await postFrom('198.51.100.11', path).send({ email, captchaToken: 'good' })).status).toBe(202);
  });
});

describe('otp-verify-ip', () => {
  it(`allows ${FIFTEEN_MIN_LIMITS.otpVerify} verify attempts per IP, then 429`, async () => {
    const provider = await createLiveProvider();
    const path = `/v1/portal/${provider.slug}/otp/verify`;
    const body = { email: newEmail(), code: '000000', challenge: 'x'.repeat(32) };
    const ip = '198.51.100.20';

    for (let i = 0; i < FIFTEEN_MIN_LIMITS.otpVerify; i++) {
      expect((await postFrom(ip, path).send(body)).status).not.toBe(429);
    }
    expectJson429(await postFrom(ip, path).send(body));
    expect((await postFrom('198.51.100.21', path).send(body)).status).not.toBe(429);
  });
});

describe('portal-booking-ip', () => {
  it(`allows ${FIFTEEN_MIN_LIMITS.booking} booking attempts per IP, counted before the session check`, async () => {
    const ip = '198.51.100.30';
    for (let i = 0; i < FIFTEEN_MIN_LIMITS.booking; i++) {
      expect((await postFrom(ip, '/v1/portal/bookings').send({})).status).toBe(401);
    }
    expectJson429(await postFrom(ip, '/v1/portal/bookings').send({}));
  });
});

describe('portal-change-ip', () => {
  it('is one budget shared by appointment cancel, reschedule and request cancel', async () => {
    const ip = '198.51.100.40';
    const id = randomUUID();
    const paths = [
      `/v1/portal/appointments/${id}/cancel`,
      `/v1/portal/appointments/${id}/reschedule`,
      `/v1/portal/requests/${id}/cancel`,
    ];
    for (let i = 0; i < FIFTEEN_MIN_LIMITS.change; i++) {
      expect((await postFrom(ip, paths[ i % paths.length ]!).send({})).status).toBe(401);
    }
    for (const path of paths) expectJson429(await postFrom(ip, path).send({}));

    const slots = await request(app).get(`/v1/portal/appointments/${id}/slots`).set('X-Forwarded-For', ip);
    expect(slots.status).toBe(401);
    expect((await postFrom(ip, '/v1/portal/bookings').send({})).status).toBe(401);
  });
});

describe('class limiters run before body parsing', () => {
  const max = config.publicRateLimit.maxRequests;

  it('public-ip: once exhausted, oversized and malformed bodies are 429 too, not 413/400', async () => {
    const ip = '198.51.100.50';
    for (let i = 0; i < max; i++) {
      await request(app).get('/v1/public/providers/no-such-provider').set('X-Forwarded-For', ip);
    }
    const path = '/v1/public/providers/no-such-provider/otp';
    expectJson429(await postFrom(ip, path).send({ email: 'x'.repeat(11 * 1024) }));
    expectJson429(await postFrom(ip, path).set('Content-Type', 'application/json').send('{"email":'));
    expect((await request(app).get('/v1/public/providers/no-such-provider').set('X-Forwarded-For', '198.51.100.51')).status).toBe(404);
  });

  it('portal-ip: once exhausted, session routes answer 429 without setting a cookie', async () => {
    const ip = '198.51.100.60';
    for (let i = 0; i < max; i++) {
      await request(app).get('/v1/portal/session').set('X-Forwarded-For', ip);
    }
    expectJson429(await postFrom(ip, '/v1/portal/logout').set('Content-Type', 'application/json').send('{"a":'));
    expectJson429(await request(app).get('/v1/portal/session').set('X-Forwarded-For', ip));
  });
});

describe('no secrets in URLs', () => {
  function registeredPaths(build: () => unknown): string[] {
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(ExpressRouter())) as {
      use: (...args: unknown[]) => unknown;
      route: (path: unknown) => unknown;
    };
    const use = vi.spyOn(proto, 'use');
    const route = vi.spyOn(proto, 'route');
    try {
      build();
      const firsts = [ ...use.mock.calls.map((args) => args[ 0 ]), ...route.mock.calls.map((args) => args[ 0 ]) ];
      return firsts.flat().filter((p): p is string => typeof p === 'string');
    } finally {
      use.mockRestore();
      route.mockRestore();
    }
  }

  it('public and session routes take only a slug or a record id as path parameters', () => {
    const paths = registeredPaths(() => { createPublicApiRouter(); createPortalSessionRouter(); });
    expect(paths.length).toBeGreaterThan(5);
    const params = new Set(paths.flatMap((p) => [ ...p.matchAll(/:(\w+)/g) ].map((m) => m[ 1 ]!)));
    expect([ ...params ].sort()).toEqual([ 'id', 'slug' ]);
  });

  it('the path recorder sees parameters in mount paths', () => {
    const paths = registeredPaths(() => ExpressRouter().use('/x/:token', ExpressRouter().get('/y', () => undefined)));
    expect(paths).toEqual(expect.arrayContaining([ '/x/:token', '/y' ]));
  });

  it('otp/verify reads the code and challenge from the body only', async () => {
    const provider = await createLiveProvider();
    const email = newEmail();
    const res = await request(app)
      .post(`/v1/portal/${provider.slug}/otp/verify?email=${encodeURIComponent(email)}&code=123456&challenge=${'x'.repeat(32)}`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({});
    expect(res.status).toBe(400);
    expect(res.headers[ 'set-cookie' ]).toBeUndefined();
  });

  it('the OTP request reads the email from the body only', async () => {
    const provider = await createLiveProvider();
    const res = await request(app)
      .post(`/v1/public/providers/${provider.slug}/otp?email=${encodeURIComponent(newEmail())}&captchaToken=good`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({});
    expect(res.status).toBe(400);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
