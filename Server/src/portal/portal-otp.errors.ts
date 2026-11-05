import { ApiError } from '../utils/errors/errors.js';

export class InvalidPortalOtpError extends ApiError {
  constructor() {
    super('Invalid or expired code', 400);
  }
}

/** Depends on policy, not on any patient, so it reveals nothing and spares the patient waiting for a code that never comes. */
export class PortalOtpCountryError extends ApiError {
  constructor() {
    super('Phone country not supported', 400);
  }
}
