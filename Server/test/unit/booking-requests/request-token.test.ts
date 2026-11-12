import { describe, expect, it } from 'vitest';
import { hashRequestToken, issueRequestToken } from '../../../src/booking-requests/request-token.js';

describe('request tokens', () => {
  it('issues a 43 character base64url token whose hash is the SHA-256 hex digest', () => {
    const { token, hash } = issueRequestToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRequestToken(token)).toBe(hash);
  });

  it('issues a different token and hash each time', () => {
    const a = issueRequestToken();
    const b = issueRequestToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});
