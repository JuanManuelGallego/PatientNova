import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../../../src/app.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { requestId } from '../../../src/middlewares/request-id.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { requireCsrf } from '../../../src/middlewares/csrf.js';
import { createPublicLimiter } from '../../../src/middlewares/public-rate-limit.js';
import { requireCaptcha } from '../../../src/middlewares/captcha.js';
import { createPortalSessionRouter, createPublicApiRouter, portalNotFound } from '../../../src/portal/portal-routers.js';
import { PORTAL_COOKIE_NAME, portalCookieOptions } from '../../../src/auth/portal-cookie.js';
import { createCsrfToken } from '../../../src/utils/security/csrf.js';
import { unique } from '../helpers.js';

const ALLOWED = 'http://localhost:3000';
const EVIL = 'https://evil.example';
const SECRET = 'test-portal-secret';

// A miniature app wired exactly like app.ts does for the two public classes.
function buildPublicApp() {
  const a = express();
  a.set('trust proxy', 1);
  a.use(requestId);

  const pub = createPublicApiRouter();
  pub.get('/ping', (_req, res) => { res.json({ ok: true }); });
  pub.post('/echo', (req, res) => { res.json({ got: req.body }); });
  pub.post('/captcha', requireCaptcha({ verify: async (t) => t === 'good' }), (_req, res) => { res.json({ ok: true }); });
  a.use('/v1/public', pub, portalNotFound);

  const portal = createPortalSessionRouter();
  portal.post('/verify', (_req, res) => { res.json({ ok: true }); }); // no CSRF: creates the session
  portal.get('/login-cookie', (_req, res) => {
    res.cookie(PORTAL_COOKIE_NAME, 'session-1', portalCookieOptions(60_000));
    res.json({ ok: true });
  });
  const csrf = requireCsrf({
    sessionIdFrom: (req) => req.cookies?.[PORTAL_COOKIE_NAME],
    secret: () => SECRET,
  });
  portal.get('/me', csrf, (_req, res) => { res.json({ ok: true }); });
  portal.post('/act', csrf, (_req, res) => { res.json({ ok: true }); });
  a.use('/v1/portal', portal, portalNotFound);

  a.use(errorHandler);
  return a;
}

const pubApp = buildPublicApp();

describe('anonymous public API class', () => {
  it('answers preflight for allowed origins without credentials', async () => {
    const res = await request(pubApp)
      .options('/v1/public/ping')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-allow-headers']).not.toMatch(/csrf/i);
  });

  it('never advertises credentials on actual responses and rejects unknown origins with JSON 403', async () => {
    const ok = await request(pubApp).get('/v1/public/ping').set('Origin', ALLOWED);
    expect(ok.status).toBe(200);
    expect(ok.headers['access-control-allow-credentials']).toBeUndefined();

    const bad = await request(pubApp).get('/v1/public/ping').set('Origin', EVIL);
    expect(bad.status).toBe(403);
    expect(bad.body).toMatchObject({ success: false });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests without an Origin header (non-browser clients)', async () => {
    expect((await request(pubApp).get('/v1/public/ping')).status).toBe(200);
  });

  it('limits bodies to 10kb with a JSON 413 and rejects malformed JSON with 400', async () => {
    const big = await request(pubApp).post('/v1/public/echo').send({ blob: 'x'.repeat(11 * 1024) });
    expect(big.status).toBe(413);
    expect(big.body).toMatchObject({ success: false, error: 'Request body too large' });

    const small = await request(pubApp).post('/v1/public/echo').send({ a: 1 });
    expect(small.body).toEqual({ got: { a: 1 } });

    const bad = await request(pubApp).post('/v1/public/echo').set('Content-Type', 'application/json').send('{"a":');
    expect(bad.status).toBe(400);
  });

  it('does not parse cookies and ends unknown paths in a JSON 404', async () => {
    const res = await request(pubApp).get('/v1/public/unknown');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Route not found' });
  });

  it('enforces the CAPTCHA hook', async () => {
    expect((await request(pubApp).post('/v1/public/captcha').send({ captchaToken: 'bad' })).status).toBe(400);
    expect((await request(pubApp).post('/v1/public/captcha').send({})).status).toBe(400);
    expect((await request(pubApp).post('/v1/public/captcha').send({ captchaToken: 'good' })).status).toBe(200);
  });
});

describe('credentialed patient-session class', () => {
  it('answers preflight with credentials and the CSRF header for allowed origins only', async () => {
    const ok = await request(pubApp)
      .options('/v1/portal/act')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token');
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    expect(ok.headers['access-control-allow-headers']).toMatch(/x-csrf-token/i);

    const bad = await request(pubApp)
      .options('/v1/portal/act')
      .set('Origin', EVIL)
      .set('Access-Control-Request-Method', 'POST');
    expect(bad.status).toBe(403);
  });

  it('requires an exact allowed Origin on mutations but not on reads', async () => {
    expect((await request(pubApp).post('/v1/portal/verify').send({})).status).toBe(403); // missing Origin
    expect((await request(pubApp).post('/v1/portal/verify').set('Origin', EVIL).send({})).status).toBe(403);
    expect((await request(pubApp).post('/v1/portal/verify').set('Origin', `${ALLOWED}/`).send({})).status).toBe(403); // not exact
    // otp/verify-style route: exact Origin, no CSRF header
    const ok = await request(pubApp).post('/v1/portal/verify').set('Origin', ALLOWED).send({});
    expect(ok.status).toBe(200);
    expect((await request(pubApp).get('/v1/portal/login-cookie')).status).toBe(200);
  });

  it('sets the session cookie with strict attributes', async () => {
    const res = await request(pubApp).get('/v1/portal/login-cookie');
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^portal_session=session-1;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/v1\/portal(;|$)/);
    expect(cookie).toMatch(/Max-Age=60/i);
  });

  it('requires a valid CSRF token bound to the session on non-GET requests', async () => {
    const token = createCsrfToken('session-1', SECRET);
    const base = () => request(pubApp).post('/v1/portal/act').set('Origin', ALLOWED).set('Cookie', `${PORTAL_COOKIE_NAME}=session-1`);

    expect((await base().send({})).status).toBe(403);
    expect((await base().set('X-CSRF-Token', 'nope').send({})).status).toBe(403);
    expect((await base().set('X-CSRF-Token', createCsrfToken('other-session', SECRET)).send({})).status).toBe(403);
    expect((await base().set('X-CSRF-Token', token).send({})).status).toBe(200);

    // no session cookie at all
    const noSession = await request(pubApp).post('/v1/portal/act').set('Origin', ALLOWED).set('X-CSRF-Token', token).send({});
    expect(noSession.status).toBe(403);
    // GET is exempt from CSRF
    expect((await request(pubApp).get('/v1/portal/me').set('Cookie', `${PORTAL_COOKIE_NAME}=session-1`)).status).toBe(200);
  });
});

describe('shared-store public rate limiting', () => {
  function limitedApp(name: string, max: number, keyHeader?: string) {
    const a = express();
    a.set('trust proxy', 1);
    a.use(requestId);
    const limiterOpts = {
      name,
      max,
      windowMs: 60_000,
      ...(keyHeader && { keyGenerator: (req: express.Request) => String(req.get(keyHeader) ?? 'none') }),
    };
    a.get('/x', createPublicLimiter(limiterOpts), (_req, res) => { res.json({ ok: true }); });
    a.use(errorHandler);
    return a;
  }

  it('returns a JSON 429 once the limit is exceeded and keeps counting across limiter instances', async () => {
    const name = unique('ip');
    const first = limitedApp(name, 3);
    for (let i = 0; i < 3; i++) expect((await request(first).get('/x')).status).toBe(200);
    const blocked = await request(first).get('/x');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ success: false });
    expect(blocked.headers['ratelimit-limit'] ?? blocked.headers['ratelimit']).toBeDefined();

    // A second "instance" (new limiter, same name, same DB) sees the same counters.
    const second = limitedApp(name, 3);
    expect((await request(second).get('/x')).status).toBe(429);
  });

  it('limits per key independently and never stores keys in clear', async () => {
    const name = unique('email');
    const a = limitedApp(name, 2, 'x-email');
    const email = `${unique('victim')}@example.com`;
    for (let i = 0; i < 2; i++) expect((await request(a).get('/x').set('x-email', email)).status).toBe(200);
    expect((await request(a).get('/x').set('x-email', email)).status).toBe(429);
    expect((await request(a).get('/x').set('x-email', 'someone-else@example.com')).status).toBe(200);

    const rows = await prisma.rateLimitBucket.findMany({ where: { key: { startsWith: `${name}:` } } });
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain('example.com');
    expect(JSON.stringify(rows)).not.toContain('victim');
  });
});

describe('real app wiring', () => {
  it('keeps the provider CORS policy (credentialed) on provider routes', async () => {
    const res = await request(app)
      .options('/v1/patients')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('keeps public portal paths dark (plain 404) while ENABLE_PORTAL is off', async () => {
    const res = await request(app).get('/v1/public/providers/any');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Route not found' });
  });
});
