import { ApiError } from '../utils/errors/errors.js';

export class PatientEmailConflictError extends ApiError {
  constructor() {
    super('A patient with this email already exists', 409)
  }
}
