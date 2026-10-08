import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { requestId } from '../../../src/middlewares/request-id.js';
import { handleError } from '../../../src/utils/api/api-utils.js';
import { ApiError } from '../../../src/utils/errors/errors.js';

function appThrowing(err: unknown) {
  const app = express();
  app.use(requestId);
  app.get('/boom', (_req, _res, next) => next(err));
  app.get('/handled', (_req, res) => handleError(res, new Error('secret db detail')));
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps ApiError to its status and message', async () => {
    const res = await request(appThrowing(new ApiError('nope', 409))).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('nope');
  });

  it('hides unexpected error text and includes the request id', async () => {
    const res = await request(appThrowing(new Error('password=hunter2'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.text).not.toContain('hunter2');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('passes through generic 4xx errors from middleware as a neutral message', async () => {
    const err = Object.assign(new Error('unsupported charset "UTF-1"'), { status: 415 });
    const res = await request(appThrowing(err)).get('/boom');
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('Bad request');
  });
});

describe('exclusion-constraint violations', () => {
  const overlapErr = {
    code: 'P2039',
    meta: {
      driverAdapterError: {
        cause: {
          originalCode: '23P01',
          originalMessage: 'conflicting key value violates exclusion constraint "appointments_no_provider_overlap"',
          detail: 'Key ("userId", ...)=(secret-user-id, ...) conflicts with existing key',
        },
      },
    },
  };

  it('maps the appointment overlap constraint to a neutral 409 in the error handler', async () => {
    const res = await request(appThrowing(overlapErr)).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Appointment overlaps with another appointment of this provider');
    expect(res.text).not.toContain('secret-user-id');
  });
});

describe('handleError', () => {
  it('never echoes internal error text, even outside production', async () => {
    const res = await request(appThrowing(null)).get('/handled');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.text).not.toContain('secret db detail');
  });
});
