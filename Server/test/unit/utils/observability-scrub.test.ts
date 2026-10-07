import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubText } from '../../../src/utils/observability/scrub.js';

describe('error-tracking scrubbing (server)', () => {
  it('masks emails and phone numbers in free text', () => {
    expect(scrubText('Failed for ana.lopez@example.com / +57 300 111 2233')).toBe('Failed for [email] / [number]');
    expect(scrubText('no pii here, code 500')).toBe('no pii here, code 500');
  });

  it('removes request bodies, cookies, headers and query strings, and reduces the user to an id', () => {
    const event = {
      message: 'Boom for ana@example.com',
      exception: { values: [ { value: 'Patient 3001112233 not found' } ] },
      request: {
        url: 'https://api.patientnova.net/v1/patients?search=ana%40example.com',
        data: { email: 'ana@example.com', name: 'Ana' },
        cookies: { token: 'secret' },
        headers: { authorization: 'Bearer abc' },
        query_string: 'search=ana',
      },
      user: { id: 'u1', email: 'dr@example.com', ip_address: '1.2.3.4' },
      extra: { patient: 'Ana' },
      breadcrumbs: [ { message: 'GET /x?email=a@b.co' } ],
    };
    const out = scrubEvent(event);
    const json = JSON.stringify(out);
    expect(out.request).toEqual({ url: 'https://api.patientnova.net/v1/patients' });
    expect(out.user).toEqual({ id: 'u1' });
    expect(out.extra).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    for (const leaked of [ 'ana@example.com', 'dr@example.com', '3001112233', 'secret', 'Bearer', '1.2.3.4', 'Ana' ]) {
      expect(json, leaked).not.toContain(leaked);
    }
  });

  it('handles minimal events', () => {
    expect(scrubEvent({})).toEqual({});
    expect(scrubEvent({ user: { email: 'x@y.co' } })).toEqual({ user: {} });
  });
});
