import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { createTurnstileVerifier } from './turnstile.js';

/** Reasons a CAPTCHA check fails. `unavailable` is the provider's fault (503), the rest the client's (400). */
export type CaptchaFailure =
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'action-mismatch'
  | 'hostname-mismatch'
  | 'unavailable';

export type CaptchaResult = { ok: true } | { ok: false; reason: CaptchaFailure };

export interface CaptchaInput {
  token: string | undefined;
  ip: string | undefined;
  /** Route-specific action the widget was rendered with, e.g. `otp-request`. */
  action: string;
}

export interface CaptchaVerifier {
  verify(input: CaptchaInput): Promise<CaptchaResult>;
}

/** Non-production only: accepts any non-empty token so local dev and tests need no provider. */
export const devBypassCaptchaVerifier: CaptchaVerifier = {
  verify: async ({ token }) => (token ? { ok: true } : { ok: false, reason: 'missing' }),
};

export function createCaptchaVerifier(
  cfg: typeof config.captcha = config.captcha,
  env: string = config.env,
): CaptchaVerifier {
  if (cfg.provider === 'turnstile') {
    return createTurnstileVerifier({ secret: cfg.secret, expectedHostnames: cfg.expectedHostnames, timeoutMs: cfg.timeoutMs });
  }
  if (env === 'production') throw new Error('A CAPTCHA provider must be configured in production');
  logger.warn('CAPTCHA_PROVIDER is not set: using the development bypass verifier');
  return devBypassCaptchaVerifier;
}
