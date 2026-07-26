import { ApiError } from '../utils/errors/errors.js';

export class BlockedTimeNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Blocked time with id "${id}" not found`, 404)
  }
}
