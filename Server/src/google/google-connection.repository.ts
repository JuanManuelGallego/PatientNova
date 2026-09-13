import { prisma } from '../utils/prisma/prisma-client.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import crypto from 'crypto';

const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';

export function isConnectionActive(conn: { refreshToken: string | null; disconnectedAt: Date | null } | null): conn is { refreshToken: string; disconnectedAt: null; grantedScopes: string[]; id: string } {
  return Boolean(conn?.refreshToken && !conn.disconnectedAt);
}

export function hashState(state: string): string {
  return crypto.createHash('sha256').update(state).digest('hex');
}

function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export const googleConnectionRepository = {
  async findByUserId(userId: string, client: TransactionClient = prisma) {
    return client.googleConnection.findUnique({
      where: { userId },
    });
  },

  async upsertConnection(
    userId: string,
    data: {
      refreshToken: string;
      grantedScopes: string[];
    },
    client: TransactionClient = prisma
  ) {
    const now = new Date();
    return client.googleConnection.upsert({
      where: { userId },
      update: {
        refreshToken: data.refreshToken,
        grantedScopes: data.grantedScopes,
        connectedAt: now,
        lastUsedAt: null,
        disconnectedAt: null,
      },
      create: {
        userId,
        refreshToken: data.refreshToken,
        grantedScopes: data.grantedScopes,
        connectedAt: now,
        lastUsedAt: null,
      },
    });
  },

  async markDisconnected(userId: string, client: TransactionClient = prisma) {
    return client.googleConnection.updateMany({
      where: { userId, disconnectedAt: null },
      data: {
        refreshToken: null,
        disconnectedAt: new Date(),
      },
    });
  },

  async deleteConnection(userId: string, client: TransactionClient = prisma) {
    return client.googleConnection.deleteMany({
      where: { userId },
    });
  },

  async rotateRefreshToken(connectionId: string, previousToken: string, refreshToken: string, client: TransactionClient = prisma) {
    return client.googleConnection.updateMany({
      where: {
        id: connectionId,
        refreshToken: previousToken,
        disconnectedAt: null,
      },
      data: { refreshToken },
    });
  },

  async updateLastUsed(userId: string, client: TransactionClient = prisma) {
    return client.googleConnection.update({
      where: { userId },
      data: { lastUsedAt: new Date() },
    });
  },

};

export const googleOAuthStateRepository = {
  async create(userId: string, returnPath: string, client: TransactionClient = prisma) {
    const state = generateState();
    const stateHash = hashState(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await client.googleOAuthState.create({
      data: {
        userId,
        stateHash,
        returnPath,
        expiresAt,
      },
    });

    return { state };
  },

  async consume(stateHash: string, client: TransactionClient = prisma) {
    const now = new Date();
    const claimed = await client.googleOAuthState.updateMany({
      where: {
        stateHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (claimed.count === 1) {
      const state = await client.googleOAuthState.findUnique({ where: { stateHash } });
      return { error: null, state };
    }

    const state = await client.googleOAuthState.findUnique({ where: { stateHash } });
    if (!state) return null;
    if (state.consumedAt) return { error: 'consumed', state: null };
    return { error: 'expired', state: null };
  },

  async cleanupExpired(client: TransactionClient = prisma) {
    const result = await client.googleOAuthState.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  },

};

export { REQUIRED_SCOPE };
