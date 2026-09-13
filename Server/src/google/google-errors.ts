import { ApiError } from '../utils/errors/errors.js';

export class GoogleOAuthError extends ApiError {
  constructor(message: string, public readonly code: string, statusCode: number = 500) {
    super(message, statusCode);
    this.name = 'GoogleOAuthError';
  }
}
