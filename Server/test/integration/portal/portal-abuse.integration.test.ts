import type express from 'express';
import { Router as ExpressRouter } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '../../../src/utils/config/config.js';
import { createPortalSessionRouter, createPublicApiRouter } from '../../../src/portal/portal-routers.js';
import { ALLOWED_ORIGIN, buildPortalApp } from './portal-helpers.js';

const FIFTEEN_MIN_LIMITS = { booking: 10, confirm: 20, change: 10 } as const;

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean; selfServe: boolean };
const portalWas = { ...portal };

beforeAll(() => { portal.patientEnabled = true; portal.selfServe = true; });
afterAll(() => { portal.patientEnabled = portalWas.patientEnabled; portal.selfServe = portalWas.selfServe; });
beforeEach(() => { app = buildPortalApp(); });

function expectJson429(res: request.Response) {
  expect(res.status).toBe(429);
  expect(res.body).toMatchObject({ success: false });
  expect(res.headers[ 'set-cookie' ]).toBeUndefined();
}

const postFrom = (ip: string, path: string) =>
  request(app).post(path).set('Origin', ALLOWED_ORIGIN).set('X-Forwarded-For', ip);

describe('portal-booking-ip', () => {
  it(`allows ${FIFTEEN_MIN_LIMITS.booking} booking attempts per IP, counted before body validation and CAPTCHA`, async () => {
    const ip = '198.51.100.30';
    const path = '/v1/public/providers/no-such-provider/bookings';
    for (let i = 0; i < FIFTEEN_MIN_LIMITS.booking; i++) {
      expect((await postFrom(ip, path).send({})).status).toBe(400);
    }
    expectJson429(await postFrom(ip, path).send({}));
    expect((await postFrom('198.51.100.31', path).send({})).status).toBe(400);
  });
});

describe('booking-confirm-ip', () => {
  it('is one budget shared by view, confirm and release, separate from the booking budget', async () => {
    const ip = '198.51.100.35';
    const paths = [
      '/v1/public/booking-confirmations/view',
      '/v1/public/booking-confirmations/confirm',
      '/v1/public/booking-confirmations/release',
    ];
    for (let i = 0; i < FIFTEEN_MIN_LIMITS.confirm; i++) {
      expect((await postFrom(ip, paths[ i % paths.length ]!).send({})).status).toBe(400);
    }
    for (const path of paths) expectJson429(await postFrom(ip, path).send({}));
    expect((await postFrom(ip, '/v1/public/providers/no-such-provider/bookings').send({})).status).toBe(400);
    expect((await postFrom('198.51.100.36', paths[ 0 ]!).send({})).status).toBe(400);
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
  });
});

describe('class limiters run before body parsing', () => {
  const max = config.publicRateLimit.maxRequests;

  it('public-ip: once exhausted, oversized and malformed bodies are 429 too, not 413/400', async () => {
    const ip = '198.51.100.50';
    for (let i = 0; i < max; i++) {
      await request(app).get('/v1/public/providers/no-such-provider').set('X-Forwarded-For', ip);
    }
    const path = '/v1/public/providers/no-such-provider/bookings';
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

  it('the booking start reads everything from the body only', async () => {
    const res = await request(app)
      .post(`/v1/public/providers/no-such-provider/bookings?email=a%40test.local&captchaToken=good&token=abc`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({});
    expect(res.status).toBe(400);
  });
});
