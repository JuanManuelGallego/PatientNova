import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (length mismatch returns false without leaking content). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
