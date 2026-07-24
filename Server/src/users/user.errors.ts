import { ApiError } from '../utils/errors/errors.js';

export class UserEmailConflictError extends ApiError {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`, 409)
  }
}
