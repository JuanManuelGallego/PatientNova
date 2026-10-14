import { config } from '../utils/config/config.js';
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

export function createCaptchaVerifier(cfg: typeof config.captcha = config.captcha): CaptchaVerifier {
  return createTurnstileVerifier({ secret: cfg.secret, expectedHostnames: cfg.expectedHostnames, timeoutMs: cfg.timeoutMs });
}
