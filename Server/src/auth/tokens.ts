import jwt from 'jsonwebtoken';
import { config } from '../utils/config/config.js';

/**
 * Single place that signs and verifies every JWT the server issues.
 *
 * Three token kinds, each bound to its own audience so one can never be accepted as another
 * (the verifier requires the exact audience), and the algorithm is pinned so a token cannot
 * choose its own (`alg: none` / key-confusion):
 *   - provider access token   (aud ACCESS_AUDIENCE)   signed with AUTH_SECRET
 *   - provider refresh token  (aud REFRESH_AUDIENCE)  signed with AUTH_SECRET
 *   - patient portal session  (aud PORTAL_AUDIENCE)   signed with PORTAL_AUTH_SECRET (distinct secret)
 */
export const TOKEN_ISSUER = 'patientnova';
export const ACCESS_AUDIENCE = 'patientnova:provider';
export const REFRESH_AUDIENCE = 'patientnova:provider-refresh';
export const PORTAL_AUDIENCE = 'patientnova:portal';

const ALGORITHM = 'HS256' as const;

export interface AccessTokenClaims {
  id: string;
  email: string;
  role: string;
  timezone: string | null;
  sid: string;
}

export interface RefreshTokenClaims {
  id: string;
  version: number;
  sid: string;
}

export interface PortalTokenClaims {
  userId: string;
  email: string;
}

function portalSecret(): string {
  const secret = config.auth.portalJwtSecret;
  if (!secret) throw new Error('PORTAL_AUTH_SECRET is not configured');
  return secret;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, config.auth.jwtSecret, {
    algorithm: ALGORITHM,
    issuer: TOKEN_ISSUER,
    audience: ACCESS_AUDIENCE,
    expiresIn: '15m',
  });
}

export function signRefreshToken(claims: RefreshTokenClaims): string {
  return jwt.sign({ ...claims, type: 'refresh' }, config.auth.jwtSecret, {
    algorithm: ALGORITHM,
    issuer: TOKEN_ISSUER,
    audience: REFRESH_AUDIENCE,
    expiresIn: '7d',
  });
}

export function signPortalToken(claims: PortalTokenClaims, expiresInSeconds = 2 * 60 * 60): string {
  return jwt.sign({ ...claims, typ: 'portal' }, portalSecret(), {
    algorithm: ALGORITHM,
    issuer: TOKEN_ISSUER,
    audience: PORTAL_AUDIENCE,
    expiresIn: expiresInSeconds,
  });
}

export function verifyAccessToken(token: string): unknown {
  return jwt.verify(token, config.auth.jwtSecret, {
    algorithms: [ ALGORITHM ],
    issuer: TOKEN_ISSUER,
    audience: ACCESS_AUDIENCE,
  });
}

export function verifyRefreshToken(token: string): unknown {
  return jwt.verify(token, config.auth.jwtSecret, {
    algorithms: [ ALGORITHM ],
    issuer: TOKEN_ISSUER,
    audience: REFRESH_AUDIENCE,
  });
}

export function verifyPortalToken(token: string): unknown {
  return jwt.verify(token, portalSecret(), {
    algorithms: [ ALGORITHM ],
    issuer: TOKEN_ISSUER,
    audience: PORTAL_AUDIENCE,
  });
}
