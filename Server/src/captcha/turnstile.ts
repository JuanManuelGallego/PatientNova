import { logger } from '../utils/api/logger.js';
import type { CaptchaFailure, CaptchaResult, CaptchaVerifier } from './captcha-verifier.js';

/** Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ */
export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Turnstile tokens are at most 2048 characters; anything longer is rejected without a network call. */
const MAX_TOKEN_LENGTH = 2048;
/** Tokens expire after 300s on Cloudflare's side; this is a local backstop on `challenge_ts`. */
const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

interface SiteverifyResponse {
  success?: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

interface TurnstileOptions {
  secret: string;
  expectedHostnames: string[];
  timeoutMs: number;
  now?: () => number;
}

const fail = (reason: CaptchaFailure): CaptchaResult => ({ ok: false, reason });

/** Maps siteverify error codes: secret/server problems are ours (`unavailable`), the rest the client's. */
function reasonFor(errorCodes: string[]): CaptchaFailure {
  if (errorCodes.some((c) => c === 'missing-input-secret' || c === 'invalid-input-secret' || c === 'internal-error')) {
    return 'unavailable';
  }
  if (errorCodes.includes('timeout-or-duplicate')) return 'expired';
  if (errorCodes.includes('missing-input-response')) return 'missing';
  return 'invalid';
}

export function createTurnstileVerifier(opts: TurnstileOptions): CaptchaVerifier {
  const now = opts.now ?? Date.now;

  return {
    async verify({ token, ip, action }) {
      if (!token) return fail('missing');
      if (token.length > MAX_TOKEN_LENGTH) return fail('invalid');

      let payload: SiteverifyResponse;
      try {
        const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ secret: opts.secret, response: token, ...(ip && { remoteip: ip }) }),
          signal: AbortSignal.timeout(opts.timeoutMs),
        });
        if (!response.ok) {
          logger.warn({ status: response.status }, 'Turnstile siteverify returned an error status');
          return fail('unavailable');
        }
        payload = (await response.json()) as SiteverifyResponse;
      } catch (err) {
        logger.warn({ err }, 'Turnstile siteverify request failed');
        return fail('unavailable');
      }

      if (payload.success !== true) {
        const errorCodes = payload[ 'error-codes' ] ?? [];
        const reason = reasonFor(errorCodes);
        if (reason === 'unavailable') logger.error({ errorCodes }, 'Turnstile rejected our request (check CAPTCHA_SECRET)');
        return fail(reason);
      }
      if (!payload.hostname || !opts.expectedHostnames.includes(payload.hostname)) return fail('hostname-mismatch');
      if (payload.action !== action) return fail('action-mismatch');

      const solvedAt = payload.challenge_ts ? Date.parse(payload.challenge_ts) : NaN;
      if (Number.isNaN(solvedAt) || now() - solvedAt > MAX_TOKEN_AGE_MS) return fail('expired');

      return { ok: true };
    },
  };
}
