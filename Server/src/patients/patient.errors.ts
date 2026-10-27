import { ApiError } from '../utils/errors/errors.js';

export class PatientEmailConflictError extends ApiError {
  constructor() {
    super('A patient with this email already exists', 409)
  }
}

export class PatientLimitReachedError extends ApiError {
  constructor(limit: number) {
    super(`Patient limit reached (${limit} per provider)`, 409)
  }
}
