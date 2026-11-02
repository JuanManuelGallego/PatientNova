import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { createTurnstileVerifier, isTurnstileTestSecret } from './turnstile.js';

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
  action: string;
}

export interface CaptchaVerifier {
  verify(input: CaptchaInput): Promise<CaptchaResult>;
}

let warnedTestSecret = false;

export function createCaptchaVerifier(cfg: typeof config.captcha = config.captcha): CaptchaVerifier {
  if (config.env === 'production' && isTurnstileTestSecret(cfg.secret) && !warnedTestSecret) {
    warnedTestSecret = true;
    logger.warn('CAPTCHA_SECRET is a Cloudflare test secret: every CAPTCHA passes. Use a real secret in production.');
  }
  return createTurnstileVerifier({ secret: cfg.secret, expectedHostnames: cfg.expectedHostnames, timeoutMs: cfg.timeoutMs });
}
