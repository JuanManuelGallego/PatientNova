import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const portal = vi.hoisted(() => ({ patientEnabled: false }));
vi.mock('../../../src/utils/config/config.js', () => ({ config: { portal } }));

import { requirePortalEnabled } from '../../../src/middlewares/require-portal-enabled.js';

function makeRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((payload: unknown) => { res.body = payload; return res; });
  return res;
}

describe('requirePortalEnabled', () => {
  it('answers 404 like an unknown route when ENABLE_PORTAL is off', () => {
    portal.patientEnabled = false;
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    requirePortalEnabled({} as Request, res as Response, next);
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when ENABLE_PORTAL is on', () => {
    portal.patientEnabled = true;
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    requirePortalEnabled({} as Request, res as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
