// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../../src/utils/config/config.js', () => ({
  config: {
    auth: { jwtSecret: 'test-secret' },
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { authenticate, requireSuperAdmin, requireAdmin, requireAdminForWrites } from '../../../src/middlewares/authenticate.js';
import { config } from '../../../src/utils/config/config.js';

function makeReq(overrides: Record<string, any> = {}) {
  return {
    cookies: {},
    headers: {},
    ip: '127.0.0.1',
    originalUrl: '/test',
    method: 'GET',
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: any) => { res.body = body; return res; });
  return res;
}

function signToken(payload: Record<string, any>) {
  return jwt.sign(payload, config.auth.jwtSecret);
}

describe('authenticate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects with 401 when no token is provided', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('extracts token from cookie', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'ADMIN', timezone: 'UTC' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('u1');
  });

  it('extracts token from Authorization Bearer header', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'ADMIN', timezone: 'UTC' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('u1');
  });

  it('rejects malformed Authorization header', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'ADMIN', timezone: 'UTC' });
    const req = makeReq({ headers: { authorization: `Token ${token}` } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 for expired token', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, config.auth.jwtSecret, { expiresIn: '-1s' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 for invalid token signature', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, 'wrong-secret');
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 when payload is missing required fields', () => {
    const token = signToken({ id: 'u1' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults timezone to UTC for legacy tokens', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'ADMIN' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(req.user.timezone).toBe('UTC');
  });

  it('uses timezone from token when present', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'ADMIN', timezone: 'America/Bogota' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(req.user.timezone).toBe('America/Bogota');
  });

  it('cookie takes precedence over Authorization header', () => {
    const cookieToken = signToken({ id: 'cookie-user', email: 'c@b.com', role: 'ADMIN', timezone: 'UTC' });
    const headerToken = signToken({ id: 'header-user', email: 'h@b.com', role: 'ADMIN', timezone: 'UTC' });
    const req = makeReq({
      cookies: { token: cookieToken },
      headers: { authorization: `Bearer ${headerToken}` },
    });
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(req.user.id).toBe('cookie-user');
  });
});

describe('requireSuperAdmin', () => {
  it('calls next when user has SUPER_ADMIN role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'SUPER_ADMIN' } });
    const res = makeRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects with 403 when user has ADMIN role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'ADMIN' } });
    const res = makeRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 when user is not set', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('calls next when user has ADMIN role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'ADMIN' } });
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next when user has SUPER_ADMIN role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'SUPER_ADMIN' } });
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects with 403 when user has VIEWER role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'VIEWER' } });
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 when user is not set', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdminForWrites', () => {
  it('calls next for GET requests without user', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    const next = vi.fn();

    requireAdminForWrites(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next for POST with ADMIN role', () => {
    const req = makeReq({ method: 'POST', user: { id: 'u1', role: 'ADMIN' } });
    const res = makeRes();
    const next = vi.fn();

    requireAdminForWrites(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects with 403 for POST with VIEWER role', () => {
    const req = makeReq({ method: 'POST', user: { id: 'u1', role: 'VIEWER' } });
    const res = makeRes();
    const next = vi.fn();

    requireAdminForWrites(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 for DELETE without user', () => {
    const req = makeReq({ method: 'DELETE' });
    const res = makeRes();
    const next = vi.fn();

    requireAdminForWrites(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for PATCH with SUPER_ADMIN role', () => {
    const req = makeReq({ method: 'PATCH', user: { id: 'u1', role: 'SUPER_ADMIN' } });
    const res = makeRes();
    const next = vi.fn();

    requireAdminForWrites(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
