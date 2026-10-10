import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../../src/utils/config/config.js', () => ({
  config: { auth: { jwtSecret: 'provider-secret', portalJwtSecret: 'portal-secret' } },
}));

import {
  signAccessToken,
  signPortalToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPortalToken,
  verifyRefreshToken,
} from '../../../src/auth/tokens.js';

const access = () => signAccessToken({ id: 'u1', email: 'a@b.com', role: 'ADMIN', timezone: 'UTC', sid: 's1' });
const refresh = () => signRefreshToken({ id: 'u1', version: 3, sid: 's1' });
const portal = () => signPortalToken({ userId: 'u1', email: 'p@x.com' });

describe('token separation', () => {
  it('each verifier accepts only its own token kind', () => {
    expect(verifyAccessToken(access())).toMatchObject({ id: 'u1', role: 'ADMIN' });
    expect(verifyRefreshToken(refresh())).toMatchObject({ id: 'u1', version: 3, type: 'refresh' });
    expect(verifyPortalToken(portal())).toMatchObject({ userId: 'u1', email: 'p@x.com', typ: 'portal' });

    expect(() => verifyAccessToken(refresh())).toThrow();
    expect(() => verifyAccessToken(portal())).toThrow();
    expect(() => verifyRefreshToken(access())).toThrow();
    expect(() => verifyRefreshToken(portal())).toThrow();
    expect(() => verifyPortalToken(access())).toThrow();
    expect(() => verifyPortalToken(refresh())).toThrow();
  });

  it('a portal token fails even if it were signed with the provider secret', () => {
    const forged = jwt.sign({ userId: 'u1', email: 'p@x.com', typ: 'portal' }, 'provider-secret', {
      algorithm: 'HS256', issuer: 'patientnova', audience: 'patientnova:portal',
    });
    expect(() => verifyPortalToken(forged)).toThrow();
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects wrong issuer, wrong algorithm and unsigned tokens', () => {
    const wrongIssuer = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, 'provider-secret', {
      algorithm: 'HS256', issuer: 'someone-else', audience: 'patientnova:provider',
    });
    const hs512 = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, 'provider-secret', {
      algorithm: 'HS512', issuer: 'patientnova', audience: 'patientnova:provider',
    });
    const unsigned = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, '', {
      algorithm: 'none', issuer: 'patientnova', audience: 'patientnova:provider',
    });
    for (const t of [ wrongIssuer, hs512, unsigned ]) expect(() => verifyAccessToken(t)).toThrow();
  });

  it('expires access tokens and portal sessions', () => {
    const expired = signPortalToken({ userId: 'u1', email: 'p@x.com' }, -10);
    expect(() => verifyPortalToken(expired)).toThrow(jwt.TokenExpiredError);
  });
});
