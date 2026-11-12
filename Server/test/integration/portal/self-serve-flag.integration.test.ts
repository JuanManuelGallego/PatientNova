import type express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../../src/utils/config/config.js';
import { userRouter } from '../../../src/users/user.routes.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { createTestToken, createTestUser } from '../helpers.js';
import { ALLOWED_ORIGIN, buildPortalApp, createLiveProvider, sessionFor } from './portal-helpers.js';
import expressLib from 'express';

const portal = config.portal as { patientEnabled: boolean; selfServe: boolean };
const was = { ...portal };
beforeAll(() => { portal.patientEnabled = true; });
afterEach(() => { portal.selfServe = was.selfServe; });
afterAll(() => { portal.patientEnabled = was.patientEnabled; portal.selfServe = was.selfServe; });

const id = randomUUID();

function sessionRoutes(app: express.Express, s: ReturnType<typeof sessionFor>) {
  const o = (r: request.Test) => r.set('Origin', ALLOWED_ORIGIN).set('Cookie', s.cookie).set('X-CSRF-Token', s.csrf);
  return {
    'GET /appointments': o(request(app).get('/v1/portal/appointments')),
    'POST /appointments/:id/cancel': o(request(app).post(`/v1/portal/appointments/${id}/cancel`).send({})),
    'POST /appointments/:id/reschedule': o(request(app).post(`/v1/portal/appointments/${id}/reschedule`)
      .send({ startUtc: new Date(Date.now() + 86_400_000 * 5).toISOString(), patientTimezone: 'America/Bogota' })),
    'GET /appointments/:id/slots': o(request(app).get(`/v1/portal/appointments/${id}/slots?from=2030-01-01&to=2030-01-02`)),
    'GET /session': o(request(app).get('/v1/portal/session')),
    'POST /logout': o(request(app).post('/v1/portal/logout').send({})),
    'POST /requests/:id/cancel': o(request(app).post(`/v1/portal/requests/${id}/cancel`).send({})),
  };
}

describe('ENABLE_SELF_SERVE', () => {
  it('off: appointments, cancel, reschedule, slots, session and request cancel are 404, even with a valid session', async () => {
    portal.selfServe = false;
    const provider = await createLiveProvider();
    const s = sessionFor(provider.id, 'paciente@test.local');
    for (const [ name, req ] of Object.entries(sessionRoutes(buildPortalApp(), s))) {
      const res = await req;
      expect(res.status, name).toBe(404);
    }
  });

  it('on: they are mounted (401 without a session)', async () => {
    portal.selfServe = true;
    const app = buildPortalApp();
    const provider = await createLiveProvider();
    const anon = sessionFor(provider.id, 'paciente@test.local');
    for (const [ name, req ] of Object.entries(sessionRoutes(app, anon))) {
      if (name === 'POST /logout') continue;
      const res = await req.unset('Cookie');
      expect(res.status, name).toBe(401);
    }
  });

  it('POST /v1/portal/bookings is gone in both states', async () => {
    for (const selfServe of [ false, true ]) {
      portal.selfServe = selfServe;
      const provider = await createLiveProvider();
      const s = sessionFor(provider.id, 'paciente@test.local');
      const res = await request(buildPortalApp()).post('/v1/portal/bookings').set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', s.cookie).set('X-CSRF-Token', s.csrf).send({});
      expect(res.status).toBe(404);
    }
  });

  it('the OTP request and verify endpoints are 404', async () => {
    portal.selfServe = true;
    const app = buildPortalApp();
    const provider = await createLiveProvider();
    const a = await request(app).post(`/v1/public/providers/${provider.slug}/otp`).set('Origin', ALLOWED_ORIGIN)
      .send({ email: 'a@test.local', captchaToken: 'x' });
    expect(a.status).toBe(404);
    const b = await request(app).post(`/v1/portal/${provider.slug}/otp/verify`).set('Origin', ALLOWED_ORIGIN)
      .send({ email: 'a@test.local', code: '123456', challenge: 'x'.repeat(32) });
    expect(b.status).toBe(404);
  });

  it('the public profile exposes selfServe and no loginChannels; reschedulePolicy needs selfServe', async () => {
    const provider = await createLiveProvider();
    for (const selfServe of [ false, true ]) {
      portal.selfServe = selfServe;
      const res = await request(buildPortalApp()).get(`/v1/public/providers/${provider.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.data.selfServe).toBe(selfServe);
      expect(res.body.data).not.toHaveProperty('loginChannels');
      if (selfServe) expect(res.body.data.reschedulePolicy).not.toBeNull();
      else expect(res.body.data.reschedulePolicy).toBeNull();
    }
  });
});

describe('GET /v1/users/me selfServeEnabled', () => {
  it('mirrors the flag in both states', async () => {
    const app = expressLib();
    app.use('/v1/users', userRouter);
    app.use(errorHandler);
    const user = await createTestUser();
    const full = await (await import('../../../src/utils/prisma/prisma-client.js')).prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    for (const selfServe of [ false, true ]) {
      portal.selfServe = selfServe;
      const res = await request(app).get('/v1/users/me').set('Authorization', `Bearer ${createTestToken({ id: full.id, email: full.email, role: full.role })}`);
      expect(res.status).toBe(200);
      expect(res.body.data.selfServeEnabled).toBe(selfServe);
    }
  });
});
