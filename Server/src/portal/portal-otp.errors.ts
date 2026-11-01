import { ApiError } from '../utils/errors/errors.js';

export class InvalidPortalOtpError extends ApiError {
  constructor() {
    super('Invalid or expired code', 400);
  }
}
