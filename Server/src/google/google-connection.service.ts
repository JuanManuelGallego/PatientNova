import { OAuth2Client } from 'google-auth-library';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { googleConnectionRepository, isConnectionActive, REQUIRED_SCOPE } from './google-connection.repository.js';
import { GoogleOAuthError } from './google-errors.js';

/**
 * Detect authorization failures from the Google SDKs or the underlying HTTP/gRPC layer:
 * - `invalid_grant` in the response body (refresh token revoked/expired)
 * - gRPC code 16 (UNAUTHENTICATED)
 * - HTTP 401 status
 */
export function isAuthorizationFailure(error: unknown): boolean {
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

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.oauthRedirectUri);
}

type ActiveConnection = { id: string; refreshToken: string };

/**
 * OAuth client for a stored connection. Google may return a new refresh token while refreshing the
 * access token; it is persisted with a compare-and-swap so a concurrent disconnect wins. Callers await
 * `tokenPersistence` before returning.
 */
export function buildOAuthClient(userId: string, conn: ActiveConnection): {
  oauth2Client: OAuth2Client;
  tokenPersistence: Promise<unknown>[];
} {
  const oauth2Client = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.oauthRedirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: conn.refreshToken });

  const tokenPersistence: Promise<unknown>[] = [];
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      tokenPersistence.push(
        googleConnectionRepository.rotateRefreshToken(conn.id, conn.refreshToken, tokens.refresh_token)
          .then((result) => {
            if (result.count === 1) logger.info({ userId }, 'Google refresh token rotated');
          })
          .catch(() => logger.error({ userId }, 'Failed to persist rotated Google refresh token')),
      );
    }
  });

  return { oauth2Client, tokenPersistence };
}

/**
 * Marks the connection expired (refresh token dropped, `disconnectedAt` set) and audits the change once.
 * The audit source comes from the audit context, so a scheduled check is recorded as JOB.
 * Returns whether this call changed the connection.
 */
export async function markConnectionExpired(userId: string, description: string): Promise<boolean> {
  const connection = await googleConnectionRepository.findByUserId(userId);
  if (!connection || connection.disconnectedAt) return false;
  const disconnected = await googleConnectionRepository.markDisconnected(userId);
  if (disconnected.count === 0) return false;
  try {
    await logAudit({
      entityType: EntityType.GOOGLE_CONNECTION,
      entityId: connection.id,
      actionType: ActionType.UPDATE,
      description,
      userId,
      affectedFields: ['connected'],
      fieldsBefore: { connected: true },
      fieldsAfter: { connected: false },
    });
  } catch {
    logger.error({ userId }, 'Failed to audit expired Google connection');
  }
  return true;
}

export type ConnectionCheckResult = 'valid' | 'expired' | 'not_connected' | 'unknown';

/**
 * Proves the stored refresh token still works by forcing an access-token refresh.
 * - success → `lastCheckedAt` is set
 * - authorization failure (`invalid_grant`, 401) → the connection is marked expired
 * - anything else (network, Google outage) → logged, connection left as is
 */
export async function verifyConnection(userId: string): Promise<ConnectionCheckResult> {
  if (!isGoogleConfigured()) {
    throw new GoogleOAuthError('Google OAuth is not configured', 'GOOGLE_CONFIG_MISSING', 503);
  }
  const conn = await googleConnectionRepository.findByUserId(userId);
  if (!isConnectionActive(conn)) return conn ? 'expired' : 'not_connected';
  if (!conn.grantedScopes.includes(REQUIRED_SCOPE)) return 'expired';

  const { oauth2Client, tokenPersistence } = buildOAuthClient(userId, conn);
  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) throw new Error('Google returned no access token');
  } catch (error) {
    await Promise.allSettled(tokenPersistence);
    if (isAuthorizationFailure(error)) {
      logger.warn({ userId }, 'Google connection check: authorization expired');
      await markConnectionExpired(userId, 'Google connection authorization expired (connection check)');
      return 'expired';
    }
    logger.warn({ userId }, 'Google connection check failed; leaving the connection unchanged');
    return 'unknown';
  }
  await Promise.allSettled(tokenPersistence);
  await googleConnectionRepository.updateLastChecked(userId);
  return 'valid';
}
