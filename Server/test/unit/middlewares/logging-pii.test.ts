import { describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../src/utils/api/logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/api/logger.js')>();
  return { ...actual, logger: loggerMock };
});

import { buildLogger, maskEmail, maskPhone } from '../../../src/utils/api/logger.js';
import { httpLogger } from '../../../src/middlewares/http-logger.js';
import { getRequestId, loggedPath, runInRequestContext } from '../../../src/utils/api/request-context.js';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()));
      cb();
    },
  });
  return { lines, log: buildLogger(stream) };
}

describe('logger redaction', () => {
  it('redacts PII keys at the top level and one level deep', () => {
    const { lines, log } = capture();
    log.info({
      email: 'ana@example.com',
      to: '+573001112233',
      patient: { name: 'Ana', lastName: 'Lopez', email: 'ana@example.com', whatsappNumber: '+573001112233' },
      body: { email: 'x@y.co', to: '+1', name: 'Ana' },
      requestId: 'keep-me',
    }, 'event');
    const out = JSON.stringify(lines[0]);
    for (const secret of [ 'ana@example.com', '573001112233', 'Lopez', 'x@y.co', '"Ana"' ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
    expect(lines[0]!.requestId).toBe('keep-me');
  });

  it('still redacts credentials', () => {
    const { lines, log } = capture();
    log.info({ password: 'hunter2', token: 't0ken', req: { headers: { authorization: 'Bearer abc', cookie: 'token=abc' } } }, 'x');
    expect(JSON.stringify(lines[0])).not.toMatch(/hunter2|t0ken|Bearer abc|token=abc/);
  });

  it('adds the current request id to every line', () => {
    const { lines, log } = capture();
    runInRequestContext({ requestId: 'req-123' }, () => log.info('inside'));
    log.info('outside');
    expect(lines[0]!.requestId).toBe('req-123');
    expect(lines[1]!.requestId).toBeUndefined();
  });
});

describe('masking helpers', () => {
  it('masks emails and phone numbers', () => {
    expect(maskEmail('ana@example.com')).toBe('a***@example.com');
    expect(maskEmail('nonsense')).toBe('***');
    expect(maskPhone('whatsapp:+57 300 111 2233')).toBe('***2233');
    expect(maskPhone('123')).toBe('***');
  });
});

describe('request logging never includes query strings', () => {
  it('loggedPath strips the query', () => {
    expect(loggedPath({ originalUrl: '/v1/patients?search=ana%40example.com&page=2' })).toBe('/v1/patients');
    expect(loggedPath({ originalUrl: '/v1/patients' })).toBe('/v1/patients');
  });

  it('httpLogger logs only method and path, never query or params', () => {
    loggerMock.info.mockClear();
    const res = { end: vi.fn(), statusCode: 200 } as any;
    const req = {
      method: 'GET',
      originalUrl: '/v1/patients?search=ana%40example.com',
      query: { search: 'ana@example.com' },
      params: { id: 'p1' },
      ip: '::ffff:10.0.0.1',
      body: undefined,
    } as any;
    httpLogger(req, res, vi.fn());
    res.end();
    const logged = JSON.stringify(loggerMock.info.mock.calls);
    expect(logged).toContain('/v1/patients');
    expect(logged).not.toContain('ana');
    expect(logged).not.toContain('search=');
    expect(getRequestId()).toBeUndefined();
  });
});
