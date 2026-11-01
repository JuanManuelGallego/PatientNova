import { ApiError } from '../utils/errors/errors.js';

/** One answer for a missing, consumed, expired, exhausted or wrong code (no oracle). */
export class InvalidPortalOtpError extends ApiError {
  constructor() {
    super('Invalid or expired code', 400);
  }
}
