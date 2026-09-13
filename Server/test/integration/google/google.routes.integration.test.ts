import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { googleRouter } from '../../../src/google/google.routes.js';
import { googleConnectionRepository, REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { createTestUser, authReq, invokeRoute } from '../helpers.js';
import { EntityType, ActionType } from '../../../generated/prisma/enums.ts';

let userId: string;
let userEmail: string;

beforeEach(async () => {
  const user = await createTestUser({ role: 'ADMIN' });
  userId = user.id;
  userEmail = user.email;
  vi.clearAllMocks();
});

function baseReq(overrides: Record<string, unknown> = {}) {
  return authReq({ id: userId, email: userEmail, role: 'ADMIN' }, {
    headers: { origin: 'http://localhost:3000' },
    ...overrides,
  });
}

describe('google routes (integration)', () => {
  describe('GET /v1/google/connection', () => {
    it('requires authentication', async () => {
      const res = await invokeRoute(googleRouter, 'get', '/connection', {
        ...authReq({ id: userId, email: userEmail, role: 'ADMIN' }),
        cookies: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('requires admin role', async () => {
      const viewer = await createTestUser({ email: 'viewer@test.local', role: 'VIEWER' });
      const res = await invokeRoute(googleRouter, 'get', '/connection', authReq({ id: viewer.id, email: viewer.email, role: 'VIEWER' }));
      expect(res.statusCode).toBe(403);
    });

    it('returns connected: false when no connection', async () => {
      const res = await invokeRoute(googleRouter, 'get', '/connection', baseReq());

      expect(res.statusCode).toBe(200);
      expect((res.body as any).success).toBe(true);
      expect((res.body as any).data).toEqual({ connected: false, connectedAt: null, lastUsedAt: null });
    });

    it('returns connected: true with details when connected', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE, 'extra'],
      });

      const res = await invokeRoute(googleRouter, 'get', '/connection', baseReq());

      expect(res.statusCode).toBe(200);
      expect((res.body as any).data.connected).toBe(true);
      expect((res.body as any).data.grantedScopes).toBeUndefined();
      expect((res.body as any).data.connectedAt).toBeDefined();
      expect((res.body as any).data.lastUsedAt).toBeNull();
    });
  });

  describe('POST /v1/google/oauth/start', () => {
    it('requires authentication', async () => {
      const res = await invokeRoute(googleRouter, 'post', '/oauth/start', {
        ...authReq({ id: userId, email: userEmail, role: 'ADMIN' }),
        cookies: {},
        body: { returnPath: '/appointments' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('requires admin role', async () => {
      const viewer = await createTestUser({ email: 'viewer@test.local', role: 'VIEWER' });
      const res = await invokeRoute(googleRouter, 'post', '/oauth/start', authReq({ id: viewer.id, email: viewer.email, role: 'VIEWER' }, { body: { returnPath: '/appointments' } }));
      expect(res.statusCode).toBe(403);
    });

    it('requires valid origin', async () => {
      const res = await invokeRoute(googleRouter, 'post', '/oauth/start', authReq({ id: userId, email: userEmail, role: 'ADMIN' }, { headers: { origin: 'http://evil.com' }, body: { returnPath: '/appointments' } }));
      expect(res.statusCode).toBe(403);
    });

    it('returns authUrl for a valid Origin', async () => {
      const res = await invokeRoute(googleRouter, 'post', '/oauth/start', baseReq({ body: { returnPath: '/appointments', isReconnect: false } }));
      expect(res.statusCode).toBe(200);
      expect((res.body as any).data.authUrl).toContain('accounts.google.com');
    });
  });

  describe('GET /v1/google/oauth/callback', () => {
    it('redirects to completion page with error for missing params', async () => {
      const res = await invokeRoute(googleRouter, 'get', '/oauth/callback', authReq({ id: userId, email: userEmail, role: 'ADMIN' }, { query: {} }));
      expect(res.statusCode).toBe(302);
      const location = String(res.headers?.Location ?? res.headers?.location ?? '');
      expect(location).toContain('/google/oauth-complete?success=false');
    });

    it('redirects with error for invalid state', async () => {
      const res = await invokeRoute(googleRouter, 'get', '/oauth/callback', authReq({ id: userId, email: userEmail, role: 'ADMIN' }, { query: { code: 'fake', state: 'invalid' } }));
      expect(res.statusCode).toBe(302);
      const location = String(res.headers?.Location ?? res.headers?.location ?? '');
      expect(location).toContain('error=invalid_state');
    });

    it('consumes valid state on provider denial and returns only a sanitized outcome', async () => {
      const { state } = await (await import('../../../src/google/google-connection.repository.js')).googleOAuthStateRepository.create(userId, '/appointments');
      const res = await invokeRoute(googleRouter, 'get', '/oauth/callback', baseReq({
        query: { error: 'raw_provider_error', error_description: 'secret', state },
      }));
      const location = String(res.headers?.location ?? '');
      expect(location).toContain('error=authorization_denied');
      expect(location).not.toContain('raw_provider_error');
      expect(location).not.toContain('secret');

      const replay = await invokeRoute(googleRouter, 'get', '/oauth/callback', baseReq({ query: { code: 'unused', state } }));
      expect(String(replay.headers?.location ?? '')).toContain('error=state_consumed');
    });
  });

  describe('DELETE /v1/google/connection', () => {
    it('requires authentication', async () => {
      const res = await invokeRoute(googleRouter, 'delete', '/connection', {
        ...authReq({ id: userId, email: userEmail, role: 'ADMIN' }),
        cookies: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('requires admin role', async () => {
      const viewer = await createTestUser({ email: 'viewer@test.local', role: 'VIEWER' });
      const res = await invokeRoute(googleRouter, 'delete', '/connection', authReq({ id: viewer.id, email: viewer.email, role: 'VIEWER' }));
      expect(res.statusCode).toBe(403);
    });

    it('requires valid origin', async () => {
      const res = await invokeRoute(googleRouter, 'delete', '/connection', authReq({ id: userId, email: userEmail, role: 'ADMIN' }, { headers: { origin: 'http://evil.com' } }));
      expect(res.statusCode).toBe(403);
    });

    it('deletes connection for a valid Origin', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });

      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      oauthClient.prototype.revokeToken = vi.fn().mockResolvedValue(undefined);
      const res = await invokeRoute(googleRouter, 'delete', '/connection', baseReq());

      expect(res.statusCode).toBe(200);
      expect((res.body as any).success).toBe(true);
      expect(await googleConnectionRepository.findByUserId(userId)).toBeNull();
    });
  });

  describe('POST /v1/google/meet', () => {
    it('requires authentication', async () => {
      const res = await invokeRoute(googleRouter, 'post', '/meet', {
        ...authReq({ id: userId, email: userEmail, role: 'ADMIN' }),
        cookies: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('requires admin role', async () => {
      const viewer = await createTestUser({ email: 'viewer@test.local', role: 'VIEWER' });
      const res = await invokeRoute(googleRouter, 'post', '/meet', authReq({ id: viewer.id, email: viewer.email, role: 'VIEWER' }));
      expect(res.statusCode).toBe(403);
    });

    it('requires valid origin', async () => {
      const res = await invokeRoute(googleRouter, 'post', '/meet', authReq({ id: userId, email: userEmail, role: 'ADMIN' }, { headers: { origin: 'http://evil.com' } }));
      expect(res.statusCode).toBe(403);
    });

    it('returns 409 when no connection with a valid Origin', async () => {
      const res = await invokeRoute(googleRouter, 'post', '/meet', baseReq());
      expect(res.statusCode).toBe(409);
      expect((res.body as any).error).toMatch(/Google account not connected/);
    });
  });

  describe('audit logging', () => {
    it('logs disconnection', async () => {
      const connection = await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      oauthClient.prototype.revokeToken = vi.fn().mockResolvedValue(undefined);
      await invokeRoute(googleRouter, 'delete', '/connection', baseReq());

      const audit = await prisma.auditLog.findFirst({
        where: { entityType: EntityType.GOOGLE_CONNECTION, entityId: connection.id },
        orderBy: { eventTimeUtc: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actionType).toBe(ActionType.DELETE);
      expect(audit!.description).toBe('Google connection disconnected');
    });
  });
});
