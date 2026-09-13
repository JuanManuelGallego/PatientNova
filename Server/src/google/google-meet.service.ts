import { SpacesServiceClient } from '@google-apps/meet';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { googleConnectionRepository, REQUIRED_SCOPE } from './google-connection.repository.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';
import { GoogleOAuthError } from './google-errors.js';

export interface MeetingSpaceResult {
  meetingUrl: string;
  spaceName: string;
}

function isAuthorizationFailure(error: unknown): boolean {
  const providerError = error as {
    code?: number | string;
    status?: number;
    response?: { status?: number; data?: { error?: string } };
  };
  return providerError.response?.data?.error === 'invalid_grant'
    || providerError.code === 16
    || providerError.code === 401
    || providerError.status === 401
    || providerError.response?.status === 401;
}

async function buildMeetClientForUser(userId: string): Promise<{
  client: SpacesServiceClient;
  tokenPersistence: Promise<unknown>[];
}> {
  const conn = await googleConnectionRepository.findByUserId(userId);

  if (!conn || !conn.refreshToken || conn.disconnectedAt) {
    throw new GoogleOAuthError(
      'Google account not connected. Please connect your Google account first.',
      'GOOGLE_CONNECTION_NOT_FOUND',
      409,
    );
  }
  if (!conn.grantedScopes.includes(REQUIRED_SCOPE)) {
    throw new GoogleOAuthError('Required Google Meet scope was not granted', 'GOOGLE_SCOPE_MISSING', 409);
  }

  const oauth2Client = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.oauthRedirectUri,
  );

  oauth2Client.setCredentials({
    refresh_token: conn.refreshToken,
  });

  const tokenPersistence: Promise<unknown>[] = [];
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      tokenPersistence.push(
        googleConnectionRepository.rotateRefreshToken(conn.id, conn.refreshToken!, tokens.refresh_token)
          .then((result) => {
            if (result.count === 1) logger.info({ userId }, 'Google refresh token rotated');
          })
          .catch(() => logger.error({ userId }, 'Failed to persist rotated Google refresh token')),
      );
    }
  });

  return {
    client: new SpacesServiceClient({ authClient: oauth2Client as never }),
    tokenPersistence,
  };
}

export const googleMeetService = {
  async createMeetingSpace(userId: string): Promise<MeetingSpaceResult> {
    if (!config.google.clientId || !config.google.clientSecret || !config.google.oauthRedirectUri) {
      throw new GoogleOAuthError('Google OAuth is not configured', 'GOOGLE_CONFIG_MISSING', 503);
    }

    try {
      const { client, tokenPersistence } = await buildMeetClientForUser(userId);

      const [space] = await client.createSpace({
        space: {
          config: {
            accessType: 'OPEN',
          },
        },
      });

      const meetingUrl = space.meetingUri;
      const spaceName = space.name;

      if (!meetingUrl || !spaceName) {
        throw new GoogleOAuthError(
          'Google Meet API returned an incomplete space object',
          'GOOGLE_API_ERROR',
          502,
        );
      }

      await Promise.allSettled(tokenPersistence);
      await Promise.allSettled([
        googleConnectionRepository.updateLastUsed(userId),
        logAudit({
          entityType: EntityType.GOOGLE_MEET_SPACE,
          entityId: spaceName,
          actionType: ActionType.CREATE,
          description: 'Google Meet space created',
          source: ActionSource.API,
          userId,
          affectedFields: ['accessType'],
          fieldsBefore: null,
          fieldsAfter: { accessType: 'OPEN' },
        }),
      ]).then((results) => {
        if (results.some((result) => result.status === 'rejected')) {
          logger.error({ userId, spaceName }, 'Google Meet space bookkeeping failed');
        }
      });

      logger.info({ userId, spaceName }, 'Google Meet space created');

      return { meetingUrl, spaceName };
    } catch (error) {
      if (error instanceof GoogleOAuthError) throw error;

      if (isAuthorizationFailure(error)) {
        logger.warn({ userId }, 'Google Meet authorization expired');
        const connection = await googleConnectionRepository.findByUserId(userId);
        if (connection) {
          const disconnected = await googleConnectionRepository.markDisconnected(userId);
          if (disconnected.count > 0) {
            try {
              await logAudit({
                entityType: EntityType.GOOGLE_CONNECTION,
                entityId: connection.id,
                actionType: ActionType.UPDATE,
                description: 'Google connection authorization expired',
                source: ActionSource.API,
                userId,
                affectedFields: ['connected'],
                fieldsBefore: { connected: true },
                fieldsAfter: { connected: false },
              });
            } catch {
              logger.error({ userId }, 'Failed to audit expired Google connection');
            }
          }
        }

        throw new GoogleOAuthError(
          'Google authorization was revoked. Please reconnect your account.',
          'GOOGLE_TOKEN_REVOKED',
          409,
        );
      }

      logger.error({ userId }, 'Error creating Google Meet space');

      const connection = await googleConnectionRepository.findByUserId(userId);
      if (connection) {
        try {
          await logAudit({
            entityType: EntityType.GOOGLE_MEET_SPACE,
            entityId: connection.id,
            actionType: ActionType.CREATE,
            description: 'Google Meet space creation failed',
            source: ActionSource.API,
            userId,
            affectedFields: ['outcome'],
            fieldsBefore: null,
            fieldsAfter: { outcome: 'failed' },
          });
        } catch {
          logger.error({ userId }, 'Failed to audit Google Meet creation failure');
        }
      }

      throw new GoogleOAuthError('Failed to create Google Meet space', 'GOOGLE_API_ERROR', 502);
    }
  },
};
