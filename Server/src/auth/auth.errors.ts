import { ApiError } from '../utils/errors/errors.js';

export class UserInvalidCredentialsError extends ApiError {
  constructor() {
    super('Current password is incorrect', 401)
  }
}

export class AuthInvalidCredentialsError extends ApiError {
  constructor() {
    super('Invalid credentials', 401)
  }
}

export class AuthAccountLockedError extends ApiError {
  constructor() {
    super('Account temporarily locked. Try again later.', 423)
  }
}

export class AuthRefreshTokenExpiredError extends ApiError {
  constructor() {
    super('Refresh token expired', 401)
  }
}

export class AuthRefreshTokenRevokedError extends ApiError {
  constructor() {
    super('Refresh token has been revoked', 401)
  }
}
