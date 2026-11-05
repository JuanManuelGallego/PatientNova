import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { googleConnectionRepository, REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { verifyConnection } from '../../../src/google/google-connection.service.js';
import { checkGoogleConnectionsWorker } from '../../../src/scheduler/workers/check-google-connections.js';
import { createTestUser } from '../helpers.js';
import { ActionSource, EntityType } from '../../../generated/prisma/enums.ts';

// The refresh request is the only network call; it is replaced on the real client's prototype,
// the same way the other Google tests patch the SDKs.
type RefreshImpl = (this: OAuth2Client, refreshToken: string) => Promise<unknown>;
const refreshSpy = () => vi.spyOn(OAuth2Client.prototype as unknown as { refreshTokenNoCache: RefreshImpl }, 'refreshTokenNoCache');

function refreshSucceeds(newRefreshToken?: string) {
  return refreshSpy().mockImplementation(async function (this: OAuth2Client) {
    const tokens = { access_token: 'access', expiry_date: Date.now() + 3_600_000, ...(newRefreshToken && { refresh_token: newRefreshToken }) };
    this.emit('tokens', tokens);
    return { tokens, res: null };
  });
}

const invalidGrant = () => Object.assign(new Error('invalid_grant'), { response: { status: 400, data: { error: 'invalid_grant' } } });

let userId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function connect(id: string, refreshToken = 'token') {
  return googleConnectionRepository.upsertConnection(id, { refreshToken, grantedScopes: [ REQUIRED_SCOPE ] });
}

async function expiryAudits(id: string) {
  return prisma.auditLog.findMany({ where: { userId: id, entityType: EntityType.GOOGLE_CONNECTION } });
}

describe('verifyConnection', () => {
  it('records lastCheckedAt when Google refreshes the token', async () => {
    await connect(userId);
    const spy = refreshSucceeds();

    await expect(verifyConnection(userId)).resolves.toBe('valid');

    expect(spy).toHaveBeenCalledWith('token');
    const conn = await googleConnectionRepository.findByUserId(userId);
    expect(conn!.lastCheckedAt).toBeInstanceOf(Date);
    expect(conn!.disconnectedAt).toBeNull();
    expect(conn!.refreshToken).toBe('token');
  });

  it('persists a refresh token rotated by Google', async () => {
    await connect(userId, 'old-token');
    refreshSucceeds('rotated-token');

    await expect(verifyConnection(userId)).resolves.toBe('valid');

    expect((await googleConnectionRepository.findByUserId(userId))!.refreshToken).toBe('rotated-token');
  });

  it('marks the connection expired on invalid_grant and audits once', async () => {
    await connect(userId);
    refreshSpy().mockRejectedValue(invalidGrant());

    await expect(verifyConnection(userId)).resolves.toBe('expired');
    await expect(verifyConnection(userId)).resolves.toBe('expired');

    const conn = await googleConnectionRepository.findByUserId(userId);
    expect(conn!.refreshToken).toBeNull();
    expect(conn!.disconnectedAt).toBeInstanceOf(Date);
    expect(conn!.lastCheckedAt).toBeNull();
    const audits = await expiryAudits(userId);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.source).toBe(ActionSource.JOB);
  });

  it('leaves the connection alone on a transient failure', async () => {
    await connect(userId);
    refreshSpy().mockRejectedValue(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));

    await expect(verifyConnection(userId)).resolves.toBe('unknown');

    const conn = await googleConnectionRepository.findByUserId(userId);
    expect(conn!.refreshToken).toBe('token');
    expect(conn!.disconnectedAt).toBeNull();
    expect(conn!.lastCheckedAt).toBeNull();
    expect(await expiryAudits(userId)).toHaveLength(0);
  });

  it('does not call Google without an active connection', async () => {
    const spy = refreshSpy();

    await expect(verifyConnection(userId)).resolves.toBe('not_connected');
    await connect(userId);
    await googleConnectionRepository.markDisconnected(userId);
    await expect(verifyConnection(userId)).resolves.toBe('expired');

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('checkGoogleConnectionsWorker', () => {
  it('expires only the rejected connection and audits it as JOB', async () => {
    const otherId = (await createTestUser()).id;
    const disconnectedId = (await createTestUser()).id;
    await connect(userId, 'revoked-token');
    await connect(otherId, 'good-token');
    await connect(disconnectedId, 'gone-token');
    await googleConnectionRepository.markDisconnected(disconnectedId);

    const spy = refreshSpy().mockImplementation(async function (this: OAuth2Client, refreshToken: string) {
      if (refreshToken === 'revoked-token') throw invalidGrant();
      const tokens = { access_token: 'access', expiry_date: Date.now() + 3_600_000 };
      return { tokens, res: null };
    });

    await checkGoogleConnectionsWorker();

    expect(spy).toHaveBeenCalledTimes(2);
    expect((await googleConnectionRepository.findByUserId(userId))!.disconnectedAt).toBeInstanceOf(Date);
    const other = await googleConnectionRepository.findByUserId(otherId);
    expect(other!.disconnectedAt).toBeNull();
    expect(other!.lastCheckedAt).toBeInstanceOf(Date);

    const audits = await expiryAudits(userId);
    expect(audits).toHaveLength(1);
    expect(audits[0]!).toMatchObject({ source: ActionSource.JOB, actorId: 'scheduler' });
    expect(await expiryAudits(otherId)).toHaveLength(0);
    expect(await expiryAudits(disconnectedId)).toHaveLength(0);
  });

  it('is a no-op on a second run after expiring a connection', async () => {
    await connect(userId);
    const spy = refreshSpy().mockRejectedValue(invalidGrant());

    await checkGoogleConnectionsWorker();
    await checkGoogleConnectionsWorker();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(await expiryAudits(userId)).toHaveLength(1);
  });

  it('keeps checking the others when one check fails transiently', async () => {
    const otherId = (await createTestUser()).id;
    await connect(userId, 'flaky-token');
    await connect(otherId, 'good-token');
    refreshSpy().mockImplementation(async function (this: OAuth2Client, refreshToken: string) {
      if (refreshToken === 'flaky-token') throw new Error('503 from Google');
      return { tokens: { access_token: 'access', expiry_date: Date.now() + 3_600_000 }, res: null };
    });

    await checkGoogleConnectionsWorker();

    expect((await googleConnectionRepository.findByUserId(userId))!.disconnectedAt).toBeNull();
    expect((await googleConnectionRepository.findByUserId(otherId))!.lastCheckedAt).toBeInstanceOf(Date);
  });
});
