import { ApiError } from '../utils/errors/errors.js';

export class ConsentDocumentNotFoundError extends ApiError {
  constructor(userId: string) {
    super(`Consent document for user with id "${userId}" not found`, 404)
  }
}

export class ConsentDocumentAlreadyExistsError extends ApiError {
  constructor(userId: string) {
    super(`A consent document for user with id "${userId}" already exists`, 409)
  }
}
