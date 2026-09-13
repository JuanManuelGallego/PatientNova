import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { googleConnectionRepository, googleOAuthStateRepository, hashState, REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { createTestUser } from '../helpers.js';

let userId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
});

describe('googleConnectionRepository (integration)', () => {
  it('findByUserId returns null for non-existent user', async () => {
    const conn = await googleConnectionRepository.findByUserId(userId);
    expect(conn).toBeNull();
  });

  it('upsertConnection creates a new connection', async () => {
    const conn = await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'test-refresh-token',
      grantedScopes: [REQUIRED_SCOPE],
    });

    expect(conn).toBeDefined();
    expect(conn.userId).toBe(userId);
    expect(conn.refreshToken).toBe('test-refresh-token');
    expect(conn.grantedScopes).toEqual([REQUIRED_SCOPE]);
    expect(conn.connectedAt).toBeInstanceOf(Date);
    expect(conn.lastUsedAt).toBeNull();
    expect(conn.disconnectedAt).toBeNull();
  });

  it('upsertConnection updates existing connection', async () => {
    await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'old-token',
      grantedScopes: [REQUIRED_SCOPE],
    });

    const conn = await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'new-token',
      grantedScopes: [REQUIRED_SCOPE, 'extra-scope'],
    });

    expect(conn.refreshToken).toBe('new-token');
    expect(conn.grantedScopes).toEqual([REQUIRED_SCOPE, 'extra-scope']);
    expect(conn.lastUsedAt).toBeNull();
    expect(conn.disconnectedAt).toBeNull();
  });

  it('markDisconnected clears refreshToken and sets disconnectedAt', async () => {
    await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'test-token',
      grantedScopes: [REQUIRED_SCOPE],
    });

    await googleConnectionRepository.markDisconnected(userId);

    const conn = await googleConnectionRepository.findByUserId(userId);
    expect(conn).not.toBeNull();
    expect(conn!.refreshToken).toBeNull();
    expect(conn!.disconnectedAt).toBeInstanceOf(Date);
  });

  it('deleteConnection removes the connection', async () => {
    await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'test-token',
      grantedScopes: [REQUIRED_SCOPE],
    });

    await googleConnectionRepository.deleteConnection(userId);

    const conn = await googleConnectionRepository.findByUserId(userId);
    expect(conn).toBeNull();
  });

  it('does not resurrect a connection when token rotation loses to disconnect', async () => {
    const connection = await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'old-token',
      grantedScopes: [REQUIRED_SCOPE],
    });
    await googleConnectionRepository.deleteConnection(userId);

    const rotated = await googleConnectionRepository.rotateRefreshToken(connection.id, 'old-token', 'new-token');

    expect(rotated.count).toBe(0);
    expect(await googleConnectionRepository.findByUserId(userId)).toBeNull();
  });

  it('updateLastUsed updates lastUsedAt', async () => {
    await googleConnectionRepository.upsertConnection(userId, {
      refreshToken: 'test-token',
      grantedScopes: [REQUIRED_SCOPE],
    });

    const before = await googleConnectionRepository.findByUserId(userId);
    expect(before!.lastUsedAt).toBeNull();

    await new Promise((r) => setTimeout(r, 10));

    await googleConnectionRepository.updateLastUsed(userId);

    const after = await googleConnectionRepository.findByUserId(userId);
    expect(after!.lastUsedAt).toBeInstanceOf(Date);
  });

});

describe('googleOAuthStateRepository (integration)', () => {
  it('create generates state and stores hashed state', async () => {
    const { state } = await googleOAuthStateRepository.create(userId, '/appointments');
    const stateHash = hashState(state);

    expect(state).toBeDefined();
    expect(stateHash).toBeDefined();
    expect(state).not.toBe(stateHash);
    expect(state.length).toBeGreaterThan(20);

    const stored = await prisma.googleOAuthState.findUnique({ where: { stateHash } });
    expect(stored).not.toBeNull();
    expect(stored!.userId).toBe(userId);
    expect(stored!.returnPath).toBe('/appointments');
    expect(stored!.consumedAt).toBeNull();
  });

  it('consume returns state and marks consumed', async () => {
    const { state } = await googleOAuthStateRepository.create(userId, '/settings');
    const stateHash = hashState(state);

    const result = await googleOAuthStateRepository.consume(stateHash);

    expect(result).not.toBeNull();
    expect(result!.error).toBeNull();
    expect(result!.state).toBeDefined();
    expect(result!.state!.userId).toBe(userId);
    expect(result!.state!.returnPath).toBe('/settings');

    const stored = await prisma.googleOAuthState.findUnique({ where: { stateHash } });
    expect(stored!.consumedAt).toBeInstanceOf(Date);
  });

  it('consume returns consumed error for already consumed state', async () => {
    const { state } = await googleOAuthStateRepository.create(userId, '/appointments');
    const stateHash = hashState(state);

    await googleOAuthStateRepository.consume(stateHash);
    const result = await googleOAuthStateRepository.consume(stateHash);

    expect(result).toEqual({ error: 'consumed', state: null });
  });

  it('allows exactly one concurrent consumer to claim a state', async () => {
    const { state } = await googleOAuthStateRepository.create(userId, '/appointments');
    const stateHash = hashState(state);

    const results = await Promise.all([
      googleOAuthStateRepository.consume(stateHash),
      googleOAuthStateRepository.consume(stateHash),
    ]);

    expect(results.filter((result) => result?.error === null)).toHaveLength(1);
    expect(results.filter((result) => result?.error === 'consumed')).toHaveLength(1);
  });

  it('consume returns expired error for expired state', async () => {
    const state = 'expired-state';
    const stateHash = hashState(state);
    const expiresAt = new Date(Date.now() - 1000);

    await prisma.googleOAuthState.create({
      data: { userId, stateHash, returnPath: '/', expiresAt },
    });

    const result = await googleOAuthStateRepository.consume(stateHash);

    expect(result).toEqual({ error: 'expired', state: null });
  });

  it('consume returns null for non-existent state', async () => {
    const stateHash = hashState('non-existent');
    const result = await googleOAuthStateRepository.consume(stateHash);
    expect(result).toBeNull();
  });
});
