import { ApiError } from '../utils/errors/errors.js';

export class LocationNameConflictError extends ApiError {
  constructor(name: string) {
    super(`An appointment location named "${name}" already exists`, 409)
  }
}
