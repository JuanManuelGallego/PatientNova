import { createHash, randomBytes } from 'node:crypto';

export function issueRequestToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRequestToken(token) };
}

export function hashRequestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
