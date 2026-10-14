import { config } from '../utils/config/config.js';
import { createTurnstileVerifier } from './turnstile.js';

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

export function createCaptchaVerifier(cfg: typeof config.captcha = config.captcha): CaptchaVerifier {
  return createTurnstileVerifier({ secret: cfg.secret, expectedHostnames: cfg.expectedHostnames, timeoutMs: cfg.timeoutMs });
}
