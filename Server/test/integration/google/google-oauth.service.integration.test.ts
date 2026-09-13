import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { googleOAuthService } from '../../../src/google/google-oauth.service.js';
import { googleConnectionRepository, googleOAuthStateRepository, hashState, REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { createTestUser } from '../helpers.js';
import { ActionType, EntityType } from '../../../generated/prisma/enums.ts';

let userId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  vi.clearAllMocks();
});

describe('googleOAuthService (integration)', () => {
  describe('generateAuthUrl', () => {
    it('returns authUrl when config present (test env has dummy config)', async () => {
      const result = await googleOAuthService.generateAuthUrl(userId, '/appointments');
      expect(result.authUrl).toBeDefined();
      expect(result.authUrl).toContain('accounts.google.com');
      expect(result.state).toBeDefined();
      expect(new URL(result.authUrl).searchParams.get('prompt')).toBe('consent');
    });

    it('only prompts for consent on an existing connection when reconnecting', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'existing-token',
        grantedScopes: [REQUIRED_SCOPE],
      });

      const normal = await googleOAuthService.generateAuthUrl(userId, '/appointments');
      const reconnect = await googleOAuthService.generateAuthUrl(userId, '/appointments', true);

      expect(new URL(normal.authUrl).searchParams.has('prompt')).toBe(false);
      expect(new URL(reconnect.authUrl).searchParams.get('prompt')).toBe('consent');
    });

    it('throws an auth error for invalid returnPath', async () => {
      await expect(
        googleOAuthService.generateAuthUrl(userId, '/invalid')
      ).rejects.toThrow('Invalid return path');
    });
  });

  describe('handleCallback', () => {
    it('throws an invalid-state error for invalid state', async () => {
      await expect(
        googleOAuthService.handleCallback('fake-code', 'invalid-state')
      ).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
    });

    it('throws a consumed-state error for consumed state', async () => {
      const { state } = await googleOAuthStateRepository.create(userId, '/appointments');
      await googleOAuthStateRepository.consume(
        hashState(state)
      );

      await expect(
        googleOAuthService.handleCallback('fake-code', state)
      ).rejects.toMatchObject({ code: 'OAUTH_STATE_CONSUMED' });
    });

    it('throws an invalid-state error for expired state', async () => {
      const state = 'expired-state';
      const stateHash = hashState(state);
      await prisma.googleOAuthState.create({
        data: { userId, stateHash, returnPath: '/', expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        googleOAuthService.handleCallback('fake-code', state)
      ).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
    });

    it('audits initial authorization as CREATE and reauthorization as UPDATE using the connection id', async () => {
      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      oauthClient.prototype.getToken = vi.fn()
        .mockResolvedValueOnce({ tokens: { refresh_token: 'initial-refresh', access_token: 'access-1' } })
        .mockResolvedValueOnce({ tokens: { access_token: 'access-2' } });
      oauthClient.prototype.getTokenInfo = vi.fn().mockResolvedValue({ scopes: [REQUIRED_SCOPE] });
      const first = await googleOAuthStateRepository.create(userId, '/appointments');

      await googleOAuthService.handleCallback('first-code', first.state);
      const connection = await googleConnectionRepository.findByUserId(userId);
      expect(connection?.lastUsedAt).toBeNull();

      const second = await googleOAuthStateRepository.create(userId, '/settings');
      await googleOAuthService.handleCallback('second-code', second.state);

      const audits = await prisma.auditLog.findMany({
        where: { entityType: EntityType.GOOGLE_CONNECTION, entityId: connection!.id },
        orderBy: { eventTimeUtc: 'asc' },
      });
      expect(audits.map((audit) => audit.actionType)).toEqual([ActionType.CREATE, ActionType.UPDATE]);
      expect(audits.every((audit) => audit.affectedFields.length > 0)).toBe(true);
      expect((await googleConnectionRepository.findByUserId(userId))?.refreshToken).toBe('initial-refresh');
    });

    it('throws a scope error when required scope not granted', async () => {
      const { state } = await googleOAuthStateRepository.create(userId, '/appointments');

      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: { refresh_token: 'test-refresh', access_token: 'test-access' },
      });
      const mockGetTokenInfo = vi.fn().mockResolvedValue({ scopes: ['other-scope'] });

      oauthClient.prototype.getToken = mockGetToken;
      oauthClient.prototype.getTokenInfo = mockGetTokenInfo;

      await expect(
        googleOAuthService.handleCallback('fake-code', state)
      ).rejects.toMatchObject({ code: 'GOOGLE_SCOPE_MISSING' });

      await expect(
        googleOAuthService.handleCallback('fake-code', state)
      ).rejects.toMatchObject({ code: 'OAUTH_STATE_CONSUMED' });
    });

    it('consumes valid state when the provider denies authorization', async () => {
      const { state } = await googleOAuthStateRepository.create(userId, '/appointments');

      await expect(googleOAuthService.handleCallback(undefined, state, true)).rejects.toMatchObject({ code: 'GOOGLE_AUTH_FAILED' });
      await expect(googleOAuthService.handleCallback('unused', state)).rejects.toMatchObject({ code: 'OAUTH_STATE_CONSUMED' });
    });

    it('consumes valid state when code is missing', async () => {
      const { state } = await googleOAuthStateRepository.create(userId, '/appointments');

      await expect(googleOAuthService.handleCallback(undefined, state)).rejects.toMatchObject({ code: 'GOOGLE_AUTH_FAILED' });
      await expect(googleOAuthService.handleCallback('unused', state)).rejects.toMatchObject({ code: 'OAUTH_STATE_CONSUMED' });
    });

    it('consumes valid state when token exchange fails', async () => {
      const { state } = await googleOAuthStateRepository.create(userId, '/appointments');
      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      oauthClient.prototype.getToken = vi.fn().mockRejectedValue(new Error('provider secret details'));

      await expect(googleOAuthService.handleCallback('bad-code', state)).rejects.toMatchObject({ code: 'GOOGLE_AUTH_FAILED' });
      await expect(googleOAuthService.handleCallback('unused', state)).rejects.toMatchObject({ code: 'OAUTH_STATE_CONSUMED' });
    });
  });

  describe('getConnectionStatus', () => {
    it('returns connected: false for no connection', async () => {
      const status = await googleOAuthService.getConnectionStatus(userId);
      expect(status).toEqual({ connected: false, connectedAt: null, lastUsedAt: null });
    });

    it('returns connected: false for disconnected connection', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      await googleConnectionRepository.markDisconnected(userId);

      const status = await googleOAuthService.getConnectionStatus(userId);
      expect(status).toEqual({ connected: false, connectedAt: null, lastUsedAt: null });
    });

    it('returns connected: true with details for active connection', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE, 'extra'],
      });

      const status = await googleOAuthService.getConnectionStatus(userId);
      expect(status.connected).toBe(true);
      expect(status.connectedAt).toBeInstanceOf(Date);
      expect(status.lastUsedAt).toBeNull();
      expect(status).not.toHaveProperty('grantedScopes');
    });
  });

  describe('disconnect', () => {
    it('deletes connection and returns success', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'test-token',
        grantedScopes: [REQUIRED_SCOPE],
      });

      const result = await googleOAuthService.disconnect(userId);

      expect(result).toEqual({ success: true });

      const conn = await googleConnectionRepository.findByUserId(userId);
      expect(conn).toBeNull();
    });

    it('attempts token revocation before deletion', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'test-token',
        grantedScopes: [REQUIRED_SCOPE],
      });

      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      const mockRevokeToken = vi.fn().mockResolvedValue(undefined);
      oauthClient.prototype.revokeToken = mockRevokeToken;

      await googleOAuthService.disconnect(userId);

      expect(mockRevokeToken).toHaveBeenCalledWith('test-token');
    });

    it('deletes locally and remains idempotent when revocation fails', async () => {
      const connection = await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'test-token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const oauthClient = vi.mocked(await import('google-auth-library')).OAuth2Client;
      oauthClient.prototype.revokeToken = vi.fn().mockRejectedValue(new Error('provider secret details'));

      await expect(googleOAuthService.disconnect(userId)).resolves.toEqual({ success: true });
      await expect(googleOAuthService.disconnect(userId)).resolves.toEqual({ success: true });
      expect(await googleConnectionRepository.findByUserId(userId)).toBeNull();

      const audits = await prisma.auditLog.findMany({
        where: { entityId: connection.id, actionType: 'DELETE' },
      });
      expect(audits).toHaveLength(1);
    });
  });
});
