import { ApiError } from '../utils/errors/errors.js';

export class PatientEmailConflictError extends ApiError {
  constructor(email: string) {
    super(`A patient with email "${email}" already exists`, 409)
  }
}
