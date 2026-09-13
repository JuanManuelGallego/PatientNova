import { OAuth2Client } from 'google-auth-library';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { googleConnectionRepository, googleOAuthStateRepository, hashState, REQUIRED_SCOPE } from './google-connection.repository.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';
import { GoogleOAuthError } from './google-errors.js';

const ALLOWED_RETURN_PATHS = ['/appointments', '/settings', '/'];

function getOAuthClient(): OAuth2Client {
  if (!config.google.clientId || !config.google.clientSecret || !config.google.oauthRedirectUri) {
    throw new GoogleOAuthError('Google OAuth is not configured', 'GOOGLE_CONFIG_MISSING', 503);
  }
  return new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.oauthRedirectUri
  );
}

function validateReturnPath(returnPath: string): void {
  if (!ALLOWED_RETURN_PATHS.includes(returnPath)) {
    throw new GoogleOAuthError('Invalid return path', 'GOOGLE_AUTH_FAILED', 409);
  }
}

export const googleOAuthService = {
  async generateAuthUrl(userId: string, returnPath: string, isReconnect: boolean = false) {
    validateReturnPath(returnPath);

    const client = getOAuthClient();
    const scopes = [REQUIRED_SCOPE];

    const connection = await googleConnectionRepository.findByUserId(userId);
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      ...((isReconnect || !connection?.refreshToken || connection.disconnectedAt) && { prompt: 'consent' }),
      include_granted_scopes: true,
    });

    const { state } = await googleOAuthStateRepository.create(userId, returnPath);

    const urlWithState = new URL(authUrl);
    urlWithState.searchParams.set('state', state);

    logger.info({ userId, returnPath, isReconnect }, 'Generated Google OAuth auth URL');

    return { authUrl: urlWithState.toString(), state };
  },

  async handleCallback(
    code: string | undefined,
    stateParam: string,
    providerDenied: boolean = false,
  ): Promise<{ success: boolean; returnPath: string; error?: string }> {
    const stateHash = hashState(stateParam);

    // This claim is committed before any provider call, so callback failures cannot
    // make a one-time state reusable.
    const result = await googleOAuthStateRepository.consume(stateHash);

    if (!result) {
      logger.warn('OAuth state not found');
      throw new GoogleOAuthError('Invalid or expired OAuth state', 'INVALID_OAUTH_STATE', 400);
    }
    if (result.error === 'consumed') {
      logger.warn('OAuth state already consumed');
      throw new GoogleOAuthError('OAuth state already used', 'OAUTH_STATE_CONSUMED', 400);
    }
    if (result.error === 'expired') {
      logger.warn('OAuth state expired');
      throw new GoogleOAuthError('Invalid or expired OAuth state', 'INVALID_OAUTH_STATE', 400);
    }
    if (!result.state) {
      logger.warn('OAuth state not found');
      throw new GoogleOAuthError('Invalid or expired OAuth state', 'INVALID_OAUTH_STATE', 400);
    }

    const { userId, returnPath } = result.state;

    if (providerDenied || !code) {
      throw new GoogleOAuthError(
        providerDenied ? 'Google authorization was denied' : 'Missing authorization code',
        'GOOGLE_AUTH_FAILED',
        409,
      );
    }

    try {
      const oauthClient = getOAuthClient();
      const { tokens } = await oauthClient.getToken(code);
      const existingConnection = await googleConnectionRepository.findByUserId(userId);
      const refreshToken = tokens.refresh_token ?? (
        existingConnection?.disconnectedAt ? undefined : existingConnection?.refreshToken ?? undefined
      );

      if (!refreshToken) {
        logger.warn({ userId }, 'No refresh token received from Google');
        throw new GoogleOAuthError(
          'No refresh token received. Please reconnect your Google account.',
          'GOOGLE_AUTH_FAILED',
          409,
        );
      }

      oauthClient.setCredentials(tokens);

      const tokenInfo = await oauthClient.getTokenInfo(tokens.access_token!);
      const grantedScopes = (tokenInfo.scopes ?? []) as string[];

      if (!grantedScopes.includes(REQUIRED_SCOPE)) {
        logger.warn({ userId, grantedScopes }, 'Required Meet scope not granted');
        throw new GoogleOAuthError('Required Google Meet scope was not granted', 'GOOGLE_SCOPE_MISSING', 409);
      }

      await prisma.$transaction(async (tx) => {
        const existing = await googleConnectionRepository.findByUserId(userId, tx);
        const connection = await googleConnectionRepository.upsertConnection(userId, {
          refreshToken,
          grantedScopes,
        }, tx);

        await logAudit({
          entityType: EntityType.GOOGLE_CONNECTION,
          entityId: connection.id,
          actionType: existing ? ActionType.UPDATE : ActionType.CREATE,
          description: existing ? 'Google connection updated' : 'Google connection created',
          source: ActionSource.API,
          userId,
          affectedFields: ['connected', 'grantedScopes', 'connectedAt'],
          fieldsBefore: existing ? { connected: Boolean(existing.refreshToken && !existing.disconnectedAt) } : null,
          fieldsAfter: { connected: true, grantedScopes },
          tx,
        });
      });

      logger.info({ userId }, 'Google connection authorization completed');

      return { success: true, returnPath };
    } catch (error) {
      if (error instanceof GoogleOAuthError) throw error;

      const err = error as Error & { response?: { data?: { error?: string } } };
      if (err.response?.data?.error === 'invalid_grant') {
        logger.warn({ userId }, 'Google authorization grant was rejected');
        await markConnectionDisconnected(userId, 'Google connection authorization expired');

        throw new GoogleOAuthError(
          'Google authorization was revoked. Please reconnect your account.',
          'GOOGLE_TOKEN_REVOKED',
          409,
        );
      }

      logger.error({ userId }, 'Google OAuth callback failed');
      throw new GoogleOAuthError('Failed to complete Google authorization', 'GOOGLE_AUTH_FAILED', 409);
    }
  },

  async getConnectionStatus(userId: string) {
    const conn = await googleConnectionRepository.findByUserId(userId);

    if (!conn || !conn.refreshToken || conn.disconnectedAt || !conn.grantedScopes.includes(REQUIRED_SCOPE)) {
      return { connected: false, connectedAt: null, lastUsedAt: null };
    }

    return {
      connected: true,
      connectedAt: conn.connectedAt,
      lastUsedAt: conn.lastUsedAt,
    };
  },

  async disconnect(userId: string) {
    const conn = await googleConnectionRepository.findByUserId(userId);

    if (conn?.refreshToken) {
      try {
        const oauthClient = getOAuthClient();
        oauthClient.setCredentials({ refresh_token: conn.refreshToken });
        await oauthClient.revokeToken(conn.refreshToken);
        logger.info({ userId }, 'Google token revoked successfully');
      } catch {
        logger.warn({ userId }, 'Failed to revoke Google token; deleting local connection');
      }
    }

    if (conn) {
      const deleted = await googleConnectionRepository.deleteConnection(userId);
      if (deleted.count > 0) {
        try {
          await logAudit({
            entityType: EntityType.GOOGLE_CONNECTION,
            entityId: conn.id,
            actionType: ActionType.DELETE,
            description: 'Google connection disconnected',
            source: ActionSource.API,
            userId,
            affectedFields: ['connected'],
            fieldsBefore: { connected: Boolean(conn.refreshToken && !conn.disconnectedAt) },
            fieldsAfter: { connected: false },
          });
        } catch {
          logger.error({ userId }, 'Failed to audit Google connection deletion');
        }
      }
    }

    logger.info({ userId }, 'Google connection deleted');

    return { success: true };
  },
};

async function markConnectionDisconnected(userId: string, description: string): Promise<void> {
  const connection = await googleConnectionRepository.findByUserId(userId);
  if (!connection || connection.disconnectedAt) return;
  const disconnected = await googleConnectionRepository.markDisconnected(userId);
  if (disconnected.count === 0) return;
  try {
    await logAudit({
      entityType: EntityType.GOOGLE_CONNECTION,
      entityId: connection.id,
      actionType: ActionType.UPDATE,
      description,
      source: ActionSource.API,
      userId,
      affectedFields: ['connected'],
      fieldsBefore: { connected: true },
      fieldsAfter: { connected: false },
    });
  } catch {
    logger.error({ userId }, 'Failed to audit disconnected Google connection');
  }
}
