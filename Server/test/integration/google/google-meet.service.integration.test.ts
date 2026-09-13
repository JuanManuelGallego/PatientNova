import { describe, it, expect, beforeEach, vi } from 'vitest';
import { googleMeetService } from '../../../src/google/google-meet.service.js';
import { googleConnectionRepository } from '../../../src/google/google-connection.repository.js';
import { createTestUser } from '../helpers.js';
import { REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';

let userId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  vi.clearAllMocks();
});

describe('googleMeetService (integration)', () => {
  describe('createMeetingSpace', () => {
    it('throws a connection error when no connection', async () => {
      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({
        code: 'GOOGLE_CONNECTION_NOT_FOUND',
      });
    });

    it('throws a connection error when connection disconnected', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      await googleConnectionRepository.markDisconnected(userId);

      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({
        code: 'GOOGLE_CONNECTION_NOT_FOUND',
      });
    });

    it('throws a token-revoked error on invalid_grant and marks disconnected', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const otherUser = await createTestUser();
      await googleConnectionRepository.upsertConnection(otherUser.id, {
        refreshToken: 'other-token',
        grantedScopes: [REQUIRED_SCOPE],
      });

      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      SpacesServiceClient.prototype.createSpace = vi.fn().mockRejectedValue(
        Object.assign(new Error('invalid_grant'), { response: { data: { error: 'invalid_grant' } } })
      );

      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({
        code: 'GOOGLE_TOKEN_REVOKED',
      });

      const conn = await googleConnectionRepository.findByUserId(userId);
      expect(conn!.refreshToken).toBeNull();
      expect(conn!.disconnectedAt).toBeInstanceOf(Date);
      expect((await googleConnectionRepository.findByUserId(otherUser.id))?.refreshToken).toBe('other-token');
    });

    it('rejects a connection that lacks the required Meet scope before calling Google', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: ['other-scope'],
      });
      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      const createSpace = vi.fn();
      SpacesServiceClient.prototype.createSpace = createSpace;

      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({
        code: 'GOOGLE_SCOPE_MISSING',
      });
      expect(createSpace).not.toHaveBeenCalled();
    });

    it('creates an OPEN space and records a non-vacuous sanitized audit', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      const createSpace = vi.fn().mockResolvedValue([{
        name: 'spaces/safe-space-id',
        meetingUri: 'https://meet.google.com/secret-code',
      }]);
      SpacesServiceClient.prototype.createSpace = createSpace;

      await expect(googleMeetService.createMeetingSpace(userId)).resolves.toEqual({
        spaceName: 'spaces/safe-space-id',
        meetingUrl: 'https://meet.google.com/secret-code',
      });
      expect(createSpace).toHaveBeenCalledWith({ space: { config: { accessType: 'OPEN' } } });

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: 'spaces/safe-space-id' },
      });
      expect(audit.affectedFields).toEqual(['accessType']);
      expect(JSON.stringify(audit)).not.toContain('https://meet.google.com');
    });

    it('returns the created space when last-used bookkeeping fails', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      SpacesServiceClient.prototype.createSpace = vi.fn().mockResolvedValue([{
        name: 'spaces/success',
        meetingUri: 'https://meet.google.com/success',
      }]);
      const updateSpy = vi.spyOn(googleConnectionRepository, 'updateLastUsed').mockRejectedValueOnce(new Error('db failed'));

      await expect(googleMeetService.createMeetingSpace(userId)).resolves.toEqual({
        spaceName: 'spaces/success',
        meetingUrl: 'https://meet.google.com/success',
      });
      updateSpy.mockRestore();
    });

    it('does not expose provider errors in thrown errors or audits', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      SpacesServiceClient.prototype.createSpace = vi.fn().mockRejectedValue(new Error('provider secret details'));

      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({ code: 'GOOGLE_API_ERROR' });
      const audits = await prisma.auditLog.findMany({ where: { userId } });
      expect(JSON.stringify(audits)).not.toContain('provider secret details');
    });

    it('does not classify filesystem errors as revoked authorization', async () => {
      const connection = await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      SpacesServiceClient.prototype.createSpace = vi.fn().mockRejectedValue(
        Object.assign(new Error('missing file'), { code: 'ENOENT' }),
      );

      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({ code: 'GOOGLE_API_ERROR' });
      const active = await googleConnectionRepository.findByUserId(userId);
      expect(active?.refreshToken).toBe('token');
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'GOOGLE_MEET_SPACE', entityId: connection.id },
      });
      expect(audit.fieldsAfter).toEqual({ outcome: 'failed' });
    });

    it('classifies gRPC unauthenticated failures as revoked authorization', async () => {
      await googleConnectionRepository.upsertConnection(userId, {
        refreshToken: 'token',
        grantedScopes: [REQUIRED_SCOPE],
      });
      const SpacesServiceClient = vi.mocked(await import('@google-apps/meet')).SpacesServiceClient;
      SpacesServiceClient.prototype.createSpace = vi.fn().mockRejectedValue(
        Object.assign(new Error('unauthenticated'), { code: 16 }),
      );

      await expect(googleMeetService.createMeetingSpace(userId)).rejects.toMatchObject({
        code: 'GOOGLE_TOKEN_REVOKED',
      });
      expect((await googleConnectionRepository.findByUserId(userId))?.refreshToken).toBeNull();
    });
  });
});
