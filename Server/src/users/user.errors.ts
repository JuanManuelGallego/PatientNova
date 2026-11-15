import { ApiError } from '../utils/errors/errors.js';

export class UserEmailConflictError extends ApiError {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`, 409)
  }
}

export class UserSelfLockoutError extends ApiError {
  constructor() {
    super('You cannot remove your own super admin access', 409)
  }
}
