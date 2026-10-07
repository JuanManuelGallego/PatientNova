import { ApiError } from '../utils/errors/errors.js';

export class PatientEmailConflictError extends ApiError {
  // Deliberately does not echo the email: the message may reach public (portal) callers
  // and must not confirm which address exists.
  constructor() {
    super('A patient with this email already exists', 409)
  }
}
