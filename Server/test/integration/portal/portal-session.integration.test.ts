import type express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const policy = vi.hoisted(() => ({ version: '2026-10-19' }));
vi.mock('../../../src/portal/privacy-policy.js', () => ({
  get PRIVACY_POLICY_VERSION() { return policy.version; },
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import {
  PORTAL_AUDIENCE,
  TOKEN_ISSUER,
  portalSecret,
  signAccessToken,
  signPortalToken,
} from '../../../src/auth/tokens.js';
import { PORTAL_COOKIE_NAME } from '../../../src/auth/portal-cookie.js';
import { ActionSource, EntityType, PatientStatus } from '../../../generated/prisma/enums.js';
import { createTestPatient, unique } from '../helpers.js';
import { ALLOWED_ORIGIN, buildPortalApp, createLiveProvider, sessionFor, type TestSession } from './portal-helpers.js';

const ALLOWED = ALLOWED_ORIGIN;
const DEFAULT_POLICY = '2026-10-19';

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
beforeEach(() => {
  app = buildPortalApp();
  policy.version = DEFAULT_POLICY;
});

const getSession = (s: Pick<TestSession, 'cookie'>) =>
  request(app).get('/v1/portal/session').set('Cookie', s.cookie);

const postConsent = (s: TestSession, body: unknown = { accepted: true }, csrf: string | null = s.csrf) => {
  const req = request(app).post('/v1/portal/consent').set('Origin', ALLOWED).set('Cookie', s.cookie);
  if (csrf !== null) req.set('X-CSRF-Token', csrf);
  return req.send(body as object);
};

const postLogout = (s: TestSession, csrf: string | null = s.csrf) => {
  const req = request(app).post('/v1/portal/logout').set('Origin', ALLOWED).set('Cookie', s.cookie);
  if (csrf !== null) req.set('X-CSRF-Token', csrf);
  return req.send();
};

const consentRows = (patientId: string) => prisma.patientConsent.findMany({ where: { patientId } });
const consentAudits = (userId: string) => prisma.auditLog.findMany({ where: { userId, entityType: EntityType.PATIENT_CONSENT } });

const shapeOf = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([ k, v ]) => [ k, typeof v ]));

describe('requirePortalSession', () => {
  it('accepts a valid portal cookie and rejects everything else with the same 401', async () => {
    const provider = await createLiveProvider();
    const email = unique('p@test.local');
    expect((await getSession(sessionFor(provider.id, email))).status).toBe(200);

    const providerToken = signAccessToken({ id: provider.id, email: 'dr@test.local', role: 'ADMIN', timezone: 'UTC', sid: 's' });
    const sign = (claims: object, opts: jwt.SignOptions, secret = portalSecret()) =>
      `${PORTAL_COOKIE_NAME}=${jwt.sign(claims, secret, { algorithm: 'HS256', issuer: TOKEN_ISSUER, ...opts })}`;
    const claims = { userId: provider.id, email, sid: 'sid-x', typ: 'portal' };
    const valid = signPortalToken({ userId: provider.id, email, sid: 'sid-x' });
    const [ header, payload ] = valid.split('.');
    const forged = `${header}.${payload}.${'A'.repeat(43)}`;

    const rejected = [
      request(app).get('/v1/portal/session'),
      request(app).get('/v1/portal/session').set('Authorization', `Bearer ${providerToken}`),
      request(app).get('/v1/portal/session').set('Cookie', `token=${providerToken}`),
      request(app).get('/v1/portal/session').set('Cookie', `${PORTAL_COOKIE_NAME}=${providerToken}`),
      request(app).get('/v1/portal/session').set('Cookie', `${PORTAL_COOKIE_NAME}=${forged}`),
      request(app).get('/v1/portal/session').set('Cookie', sign(claims, { audience: PORTAL_AUDIENCE, expiresIn: -10 })),
      request(app).get('/v1/portal/session').set('Cookie', sign(claims, { audience: 'patientnova:provider', expiresIn: 60 })),
      request(app).get('/v1/portal/session').set('Cookie', sign(claims, { audience: PORTAL_AUDIENCE, expiresIn: 60 }, config.auth.jwtSecret)),
      request(app).get('/v1/portal/session').set('Cookie', sign({ ...claims, typ: undefined }, { audience: PORTAL_AUDIENCE, expiresIn: 60 })),
      request(app).get('/v1/portal/session').set('Cookie', sign({ ...claims, sid: undefined }, { audience: PORTAL_AUDIENCE, expiresIn: 60 })),
    ];
    for (const res of await Promise.all(rejected)) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid session');
    }
  });

  it('a portal session is rejected on provider routes', async () => {
    const provider = await createLiveProvider();
    const token = signPortalToken({ userId: provider.id, email: unique('p@test.local'), sid: 's' });
    const asBearer = await request(app).get('/v1/users/me').set('Authorization', `Bearer ${token}`);
    const asProviderCookie = await request(app).get('/v1/users/me').set('Cookie', `token=${token}`);
    const asPortalCookie = await request(app).get('/v1/users/me').set('Cookie', `${PORTAL_COOKIE_NAME}=${token}`);
    expect(asBearer.status).toBe(401);
    expect(asProviderCookie.status).toBe(401);
    expect(asPortalCookie.status).toBe(401);
  });

  it('answers 401 once the provider is no longer live (disabled, deleted, inactive, portal off)', async () => {
    const disabled = await createLiveProvider();
    const deleted = await createLiveProvider();
    const sDisabled = sessionFor(disabled.id, unique('p@test.local'));
    const sDeleted = sessionFor(deleted.id, unique('p@test.local'));
    await prisma.user.update({ where: { id: disabled.id }, data: { bookingEnabled: false } });
    await prisma.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    expect((await getSession(sDisabled)).status).toBe(401);
    expect((await getSession(sDeleted)).status).toBe(401);

    const live = await createLiveProvider();
    const sLive = sessionFor(live.id, unique('p@test.local'));
    portal.patientEnabled = false;
    try {
      expect((await getSession(sLive)).status).toBe(401);
    } finally {
      portal.patientEnabled = true;
    }
  });
});

describe('GET /v1/portal/session', () => {
  it('returns identical keys and value types for every resolution outcome', async () => {
    const provider = await createLiveProvider();
    const none = unique('none@test.local');
    const patientEmail = unique('patient@test.local');
    const revokedEmail = unique('revoked@test.local');
    const inactiveEmail = unique('inactive@test.local');
    const deletedEmail = unique('deleted@test.local');
    await createTestPatient(provider.id, { email: patientEmail });
    const revoked = await createTestPatient(provider.id, { email: revokedEmail });
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const inactive = await createTestPatient(provider.id, { email: inactiveEmail });
    await prisma.patient.update({ where: { id: inactive.id }, data: { status: PatientStatus.INACTIVE } });
    const deleted = await createTestPatient(provider.id, { email: deletedEmail });
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });

    const responses = await Promise.all([ none, patientEmail, revokedEmail, inactiveEmail, deletedEmail ]
      .map((email) => getSession(sessionFor(provider.id, email))));

    const expectedShape = {
      email: 'string', expiresAt: 'string', csrfToken: 'string', providerSlug: 'string', consentRequired: 'boolean',
    };
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.headers[ 'cache-control' ]).toBe('no-store');
      expect(Object.keys(res.body).sort()).toEqual([ 'data', 'success', 'timestamp' ].sort());
      expect(shapeOf(res.body.data)).toEqual(expectedShape);
      expect(res.body.data.consentRequired).toBe(true);
      expect(res.body.data.providerSlug).toBe(provider.slug);
    }
  });

  it('echoes the session email, expiry and a CSRF token bound to the sid', async () => {
    const provider = await createLiveProvider();
    const session = sessionFor(provider.id, unique('p@test.local'));
    const res = await getSession(session);
    expect(res.body.data.email).toBe(session.email);
    expect(res.body.data.csrfToken).toBe(session.csrf);
    const expiresIn = new Date(res.body.data.expiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(115 * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(120 * 60_000);
  });

  it('consentRequired is false only for a patient with a consent at the current policy version', async () => {
    const provider = await createLiveProvider();
    const patient = await createTestPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    expect((await getSession(session)).body.data.consentRequired).toBe(true);

    expect((await postConsent(session)).status).toBe(204);
    expect((await getSession(session)).body.data.consentRequired).toBe(false);

    policy.version = '2027-01-01';
    expect((await getSession(session)).body.data.consentRequired).toBe(true);
    expect((await postConsent(session)).status).toBe(204);
    expect((await getSession(session)).body.data.consentRequired).toBe(false);
    expect((await consentRows(patient.id)).map((r) => r.policyVersion).sort()).toEqual([ DEFAULT_POLICY, '2027-01-01' ]);
  });

  it('stops resolving the patient after the provider changes the email', async () => {
    const provider = await createLiveProvider();
    const patient = await createTestPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    await postConsent(session);
    expect((await getSession(session)).body.data.consentRequired).toBe(false);

    await prisma.patient.update({ where: { id: patient.id }, data: { email: unique('new@test.local') } });
    expect((await getSession(session)).body.data.consentRequired).toBe(true);

    policy.version = '2027-01-01';
    expect((await postConsent(session)).status).toBe(204);
    expect(await consentRows(patient.id)).toHaveLength(1);
  });

  it('a patient of another provider does not resolve', async () => {
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    const patient = await createTestPatient(a.id);
    const session = sessionFor(b.id, patient.email!);
    expect((await postConsent(session)).status).toBe(204);
    expect(await consentRows(patient.id)).toHaveLength(0);
    expect((await getSession(session)).body.data.providerSlug).toBe(b.slug);
  });
});

describe('POST /v1/portal/consent', () => {
  it('records one consent with request metadata and a PUBLIC_PORTAL audit row', async () => {
    const provider = await createLiveProvider();
    const patient = await createTestPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);

    const res = await postConsent(session).set('User-Agent', 'vitest-agent');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const rows = await consentRows(patient.id);
    expect(rows).toHaveLength(1);
    expect(rows[ 0 ]).toMatchObject({
      userId: provider.id,
      kind: 'DATA_PROCESSING',
      policyVersion: DEFAULT_POLICY,
      userAgent: 'vitest-agent',
      revokedAt: null,
    });
    expect(rows[ 0 ]!.ipAddress).toBeTruthy();

    const audits = await consentAudits(provider.id);
    expect(audits).toHaveLength(1);
    expect(audits[ 0 ]).toMatchObject({
      entityId: rows[ 0 ]!.id,
      actionType: 'CREATE',
      source: ActionSource.PUBLIC_PORTAL,
    });
    expect(audits[ 0 ]!.actorId).toMatch(/^portal:[0-9a-f]{24}$/);
    expect(audits[ 0 ]!.actorDisplayName).not.toContain(patient.email!);
  });

  it('is idempotent, including under concurrency', async () => {
    const provider = await createLiveProvider();
    const patient = await createTestPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);

    const results = await Promise.all(Array.from({ length: 5 }, () => postConsent(session)));
    expect(results.map((r) => r.status)).toEqual([ 204, 204, 204, 204, 204 ]);
    expect((await postConsent(session)).status).toBe(204);

    expect(await consentRows(patient.id)).toHaveLength(1);
    expect(await consentAudits(provider.id)).toHaveLength(1);
  });

  it('answers 204 and writes nothing for none, revoked, inactive and deleted-only', async () => {
    const provider = await createLiveProvider();
    const revoked = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const inactive = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: inactive.id }, data: { status: PatientStatus.INACTIVE } });
    const deleted = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });

    for (const email of [ unique('none@test.local'), revoked.email!, inactive.email!, deleted.email! ]) {
      const res = await postConsent(sessionFor(provider.id, email));
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    }
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await consentAudits(provider.id)).toHaveLength(0);
  });

  it('requires CSRF, exact Origin and a strict body', async () => {
    const provider = await createLiveProvider();
    const patient = await createTestPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);

    expect((await postConsent(session, { accepted: true }, null)).status).toBe(403);
    expect((await postConsent(session, { accepted: true }, 'x'.repeat(43))).status).toBe(403);
    const otherSid = sessionFor(provider.id, patient.email!);
    expect((await postConsent(session, { accepted: true }, otherSid.csrf)).status).toBe(403);

    const noOrigin = await request(app).post('/v1/portal/consent').set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrf).send({ accepted: true });
    expect(noOrigin.status).toBe(403);

    expect((await postConsent(session, { accepted: false })).status).toBe(400);
    expect((await postConsent(session, {})).status).toBe(400);
    expect((await postConsent(session, { accepted: true, policyVersion: '2000-01-01' })).status).toBe(400);

    expect(await consentRows(patient.id)).toHaveLength(0);
  });
});

describe('POST /v1/portal/logout', () => {
  it('clears the session cookie on the same path', async () => {
    const provider = await createLiveProvider();
    const session = sessionFor(provider.id, unique('p@test.local'));
    const res = await postLogout(session);
    expect(res.status).toBe(204);

    const setCookie = ([] as string[]).concat(res.headers[ 'set-cookie' ] ?? []);
    const cleared = setCookie.find((c) => c.startsWith(`${PORTAL_COOKIE_NAME}=;`));
    expect(cleared).toBeDefined();
    expect(cleared).toContain('Path=/v1/portal');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
    expect(cleared).toContain('HttpOnly');
    expect(cleared).toContain('Secure');
    expect(cleared).toContain('SameSite=Lax');
  });

  it('clears the cookie even when the session no longer validates', async () => {
    const provider = await createLiveProvider();
    const session = sessionFor(provider.id, unique('p@test.local'));
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });
    const clears = (res: request.Response) => ([] as string[]).concat(res.headers[ 'set-cookie' ] ?? [])
      .some((c) => c.startsWith(`${PORTAL_COOKIE_NAME}=;`));

    const notLive = await postLogout(session, null);
    expect(notLive.status).toBe(204);
    expect(clears(notLive)).toBe(true);

    const anonymous = await request(app).post('/v1/portal/logout').set('Origin', ALLOWED).send();
    expect(anonymous.status).toBe(204);
    expect(clears(anonymous)).toBe(true);
  });

  it('requires the exact Origin', async () => {
    const provider = await createLiveProvider();
    const session = sessionFor(provider.id, unique('p@test.local'));
    const res = await request(app).post('/v1/portal/logout').set('Origin', 'https://evil.example').set('Cookie', session.cookie).send();
    expect(res.status).toBe(403);
    expect(res.headers[ 'set-cookie' ]).toBeUndefined();
  });
});

describe('unknown portal routes', () => {
  it('stay 404', async () => {
    const res = await request(app).get('/v1/portal/nope');
    expect(res.status).toBe(404);
  });
});
