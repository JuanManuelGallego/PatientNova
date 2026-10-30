import { ApiError } from '../utils/errors/errors.js';
import { VIRTUAL_NOT_BOOKABLE_MESSAGE } from './location.schemas.js';

export class LocationNameConflictError extends ApiError {
  constructor(name: string) {
    super(`An appointment location named "${name}" already exists`, 409)
  }
}

export class VirtualLocationNotBookableError extends ApiError {
  constructor() {
    super(VIRTUAL_NOT_BOOKABLE_MESSAGE, 400)
  }
}
